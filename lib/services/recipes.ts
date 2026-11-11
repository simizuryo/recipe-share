import "server-only";

import { cache } from "react";

import { getDb } from "@/lib/db";
import type { RecipeInput } from "@/lib/validation/recipe";
import {
  afterCursorWhere,
  buildRecipeWhere,
  encodeCursor,
  PAGE_SIZE,
  type RecipeCursor,
  type RecipeSearch,
} from "@/lib/search/recipe-search";

/**
 * レシピを材料・手順と一緒に保存する(F-03)。
 * ネストした create は1つのトランザクションで実行されるため、途中で失敗するとどれも保存されない。
 * 材料・手順の position は入力の順番(0始まり)。
 */
export async function createRecipe(userId: number, input: RecipeInput): Promise<{ id: number }> {
  // 投稿日と更新日を同じ時刻にそろえる(更新日が投稿日より後なら「編集した」と判断するため)
  const now = new Date();
  return getDb().recipe.create({
    data: {
      userId,
      createdAt: now,
      updatedAt: now,
      title: input.title,
      description: input.description === "" ? null : input.description,
      servings: input.servings,
      cookMinutes: input.cookMinutes,
      category: input.category,
      ingredients: {
        create: input.ingredients.map((row, position) => ({ position, name: row.name, quantity: row.quantity })),
      },
      steps: {
        create: input.steps.map((row, position) => ({ position, body: row.body })),
      },
    },
    select: { id: true },
  });
}

/** 更新・削除の結果。forbidden は他人のレシピ */
export type RecipeWriteResult = "ok" | "not_found" | "forbidden";

/**
 * レシピを編集する(F-04)。投稿者本人でなければ何も変えずに forbidden を返す。
 * 材料・手順は今の行をすべて消して入力の順番で作り直す。全体を1つのトランザクションで行い、
 * 途中で失敗した場合はどれも変更しない。
 */
export async function updateRecipe(userId: number, recipeId: number, input: RecipeInput): Promise<RecipeWriteResult> {
  return getDb().$transaction(async (tx) => {
    // 行ロックを取り、同じレシピへの編集・削除が同時に来ても順番に処理する
    const [owner] = await tx.$queryRaw<{ user_id: number }[]>`
      SELECT user_id FROM recipes WHERE id = ${recipeId} FOR UPDATE`;
    if (!owner) return "not_found";
    if (owner.user_id !== userId) return "forbidden";

    // (recipe_id, position) は一意なので、作り直す前に今の行を消す
    await tx.ingredient.deleteMany({ where: { recipeId } });
    await tx.step.deleteMany({ where: { recipeId } });
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        title: input.title,
        description: input.description === "" ? null : input.description,
        servings: input.servings,
        cookMinutes: input.cookMinutes,
        category: input.category,
        ingredients: {
          create: input.ingredients.map((row, position) => ({ position, name: row.name, quantity: row.quantity })),
        },
        steps: {
          create: input.steps.map((row, position) => ({ position, body: row.body })),
        },
      },
    });
    return "ok";
  });
}

/**
 * レシピを削除する(F-04)。投稿者本人でなければ削除せずに forbidden を返す。
 * 材料・手順・お気に入り・コメントは DB の ON DELETE CASCADE で一緒に消える。
 * 完成写真(ストレージのファイル)の削除は F-09 で追加する。
 */
export async function deleteRecipe(userId: number, recipeId: number): Promise<RecipeWriteResult> {
  const db = getDb();
  const { count } = await db.recipe.deleteMany({ where: { id: recipeId, userId } });
  if (count === 1) return "ok";
  const exists = await db.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  return exists ? "forbidden" : "not_found";
}

/**
 * レシピ詳細(F-06)。見つからなければ null。
 * 1回のリクエストの中では結果を使い回す(画面のタイトル generateMetadata と本体で2回 DB を引かない)。
 */
export const getRecipeDetail = cache(async (id: number) => {
  return getDb().recipe.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      servings: true,
      cookMinutes: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      imageKey: true,
      user: { select: { id: true, username: true, name: true } },
      _count: { select: { favorites: true } },
      ingredients: { orderBy: { position: "asc" }, select: { name: true, quantity: true } },
      steps: { orderBy: { position: "asc" }, select: { body: true } },
    },
  });
});

export type RecipeDetail = NonNullable<Awaited<ReturnType<typeof getRecipeDetail>>>;

/** 一覧のカード1枚分(F-05)。Client Component にも渡すので、日付は文字列にする */
export type RecipeCard = {
  id: number;
  title: string;
  cookMinutes: number;
  category: RecipeDetail["category"];
  imageKey: string | null;
  authorName: string;
  favoriteCount: number;
};

export type RecipePage = { items: RecipeCard[]; nextCursor: string | null };

/**
 * レシピ一覧・検索(F-05 / F-07)。新着順に PAGE_SIZE 件ずつ返す。
 * 投稿者名とお気に入り数も同じクエリで取る(N+1 にしない)。
 * 1件多く取って、続きがあるかを判断する。
 */
export async function listRecipes(search: RecipeSearch, cursor: RecipeCursor | null = null): Promise<RecipePage> {
  const where = buildRecipeWhere(search);
  const rows = await getDb().recipe.findMany({
    where: cursor ? { AND: [where, afterCursorWhere(cursor)] } : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      title: true,
      cookMinutes: true,
      category: true,
      imageKey: true,
      createdAt: true,
      user: { select: { name: true } },
      _count: { select: { favorites: true } },
    },
  });

  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      title: row.title,
      cookMinutes: row.cookMinutes,
      category: row.category,
      imageKey: row.imageKey,
      authorName: row.user.name,
      favoriteCount: row._count.favorites,
    })),
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last) : null,
  };
}

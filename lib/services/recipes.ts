import "server-only";

import { cache } from "react";

import { getDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
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
 * 材料・手順の position は入力の順番(0始まり)。imageKey は先にストレージへ保存した完成写真のキー(F-09)。
 */
export async function createRecipe(
  userId: number,
  input: RecipeInput,
  imageKey: string | null = null,
): Promise<{ id: number }> {
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
      imageKey,
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

/** 編集時の完成写真の扱い(F-09)。keep はそのまま、set は新しい写真に差し替え、remove は写真なしにする */
export type ImageChange = { type: "keep" } | { type: "set"; key: string } | { type: "remove" };

/**
 * 更新・削除の結果と、使われなくなった写真のキー。
 * ストレージのファイルは DB の変更が確定してから呼び出し側で消す(先に消すと、DB の変更が失敗したときに写真だけ消える)。
 */
export type RecipeWriteOutcome = { result: RecipeWriteResult; unusedImageKey: string | null };

/**
 * レシピを編集する(F-04)。投稿者本人でなければ何も変えずに forbidden を返す。
 * 材料・手順は今の行をすべて消して入力の順番で作り直す。全体を1つのトランザクションで行い、
 * 途中で失敗した場合はどれも変更しない。
 */
export async function updateRecipe(
  userId: number,
  recipeId: number,
  input: RecipeInput,
  image: ImageChange = { type: "keep" },
): Promise<RecipeWriteOutcome> {
  return getDb().$transaction(async (tx) => {
    // 行ロックを取り、同じレシピへの編集・削除が同時に来ても順番に処理する
    const [current] = await tx.$queryRaw<{ user_id: number; image_key: string | null }[]>`
      SELECT user_id, image_key FROM recipes WHERE id = ${recipeId} FOR UPDATE`;
    if (!current) return { result: "not_found", unusedImageKey: null };
    if (current.user_id !== userId) return { result: "forbidden", unusedImageKey: null };
    const imageKey = image.type === "keep" ? current.image_key : image.type === "set" ? image.key : null;

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
        imageKey,
        ingredients: {
          create: input.ingredients.map((row, position) => ({ position, name: row.name, quantity: row.quantity })),
        },
        steps: {
          create: input.steps.map((row, position) => ({ position, body: row.body })),
        },
      },
    });
    return { result: "ok", unusedImageKey: current.image_key !== imageKey ? current.image_key : null };
  });
}

/**
 * レシピを削除する(F-04)。投稿者本人でなければ削除せずに forbidden を返す。
 * 材料・手順・お気に入り・コメントは DB の ON DELETE CASCADE で一緒に消える。
 * 完成写真のファイルは、返した unusedImageKey を使って呼び出し側で消す(F-09)。
 */
export async function deleteRecipe(userId: number, recipeId: number): Promise<RecipeWriteOutcome> {
  const db = getDb();
  // 削除と同時に、写真のキーを受け取る(先に読むと、読んでから消すまでの間に差し替えられる可能性がある)
  const deleted = await db.$queryRaw<{ image_key: string | null }[]>`
    DELETE FROM recipes WHERE id = ${recipeId} AND user_id = ${userId} RETURNING image_key`;
  if (deleted.length === 1) return { result: "ok", unusedImageKey: deleted[0].image_key };
  const exists = await db.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  return { result: exists ? "forbidden" : "not_found", unusedImageKey: null };
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
  /** 見ている人が保存済みか(F-08)。ゲストは常に false */
  favorited: boolean;
};

export type RecipePage = { items: RecipeCard[]; nextCursor: string | null };

/**
 * カード1枚分を取る select。投稿者名・お気に入り数・見ている人が保存済みかを同じクエリで取る(N+1 にしない)。
 * 保存済みかは、見ている人のお気に入りだけに絞って最大1行を取る(誰が保存したかは返さない)。
 * ゲスト(viewerId が null)は存在しない ID 0 で絞り、常に0行にする。
 */
export function recipeCardSelect(viewerId: number | null) {
  return {
    id: true,
    title: true,
    cookMinutes: true,
    category: true,
    imageKey: true,
    createdAt: true,
    user: { select: { name: true } },
    _count: { select: { favorites: true } },
    favorites: { where: { userId: viewerId ?? 0 }, select: { userId: true }, take: 1 },
  } satisfies Prisma.RecipeSelect;
}

type RecipeCardRow = Prisma.RecipeGetPayload<{ select: ReturnType<typeof recipeCardSelect> }>;

export function toRecipeCard(row: RecipeCardRow): RecipeCard {
  return {
    id: row.id,
    title: row.title,
    cookMinutes: row.cookMinutes,
    category: row.category,
    imageKey: row.imageKey,
    authorName: row.user.name,
    favoriteCount: row._count.favorites,
    favorited: row.favorites.length > 0,
  };
}

/**
 * レシピ一覧・検索(F-05 / F-07)。新着順に PAGE_SIZE 件ずつ返す。
 * viewerId はログイン中のユーザー(ゲストは null)。お気に入りボタンの状態に使う(F-08)。
 * 1件多く取って、続きがあるかを判断する。
 */
export async function listRecipes(
  search: RecipeSearch,
  cursor: RecipeCursor | null = null,
  viewerId: number | null = null,
): Promise<RecipePage> {
  const where = buildRecipeWhere(search);
  const rows = await getDb().recipe.findMany({
    where: cursor ? { AND: [where, afterCursorWhere(cursor)] } : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select: recipeCardSelect(viewerId),
  });

  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map(toRecipeCard),
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last) : null,
  };
}

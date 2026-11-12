import "server-only";

import { getDb } from "@/lib/db";
import { afterFavoriteCursorWhere, encodeCursor, PAGE_SIZE, type RecipeCursor } from "@/lib/search/recipe-search";

import { recipeCardSelect, toRecipeCard, type RecipePage } from "./recipes";

/** 保存・解除した後の状態。レシピがなければ not_found */
export type FavoriteResult = { favorited: boolean; count: number } | "not_found";

/**
 * お気に入りに保存 / 解除する(F-08)。自分のレシピも保存できる。
 * 「切り替え」ではなく「保存する / しない」を受け取るので、二重に押されたり2つのタブから送られたりしても結果は同じになる。
 * 二重保存は主キー (user_id, recipe_id) で防ぎ、すでにあれば何もしない(ON CONFLICT DO NOTHING)。
 */
export async function setFavorite(userId: number, recipeId: number, favorited: boolean): Promise<FavoriteResult> {
  const db = getDb();
  return db.$transaction(async (tx) => {
    // レシピの行をロックして、削除と同時に来ても「消えたレシピのお気に入り」を作らない
    const [recipe] = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM recipes WHERE id = ${recipeId} FOR SHARE`;
    if (!recipe) return "not_found";

    if (favorited) {
      await tx.favorite.createMany({ data: [{ userId, recipeId }], skipDuplicates: true });
    } else {
      await tx.favorite.deleteMany({ where: { userId, recipeId } });
    }
    const count = await tx.favorite.count({ where: { recipeId } });
    return { favorited, count };
  });
}

/** レシピ詳細で、見ている人が保存済みか(F-08) */
export async function isFavorited(userId: number, recipeId: number): Promise<boolean> {
  const row = await getDb().favorite.findUnique({
    where: { userId_recipeId: { userId, recipeId } },
    select: { userId: true },
  });
  return row !== null;
}

/**
 * 自分のお気に入り一覧(F-08 / S-07)。保存した日時の新しい順に PAGE_SIZE 件ずつ返す。
 * 本人の分だけを返す(呼び出し側でログイン中のユーザーの ID を渡す)。
 * カーソルは「保存日時_レシピ ID」。
 */
export async function listFavorites(userId: number, cursor: RecipeCursor | null = null): Promise<RecipePage> {
  const rows = await getDb().favorite.findMany({
    where: cursor ? { AND: [{ userId }, afterFavoriteCursorWhere(cursor)] } : { userId },
    orderBy: [{ createdAt: "desc" }, { recipeId: "desc" }],
    take: PAGE_SIZE + 1,
    select: { createdAt: true, recipeId: true, recipe: { select: recipeCardSelect(userId) } },
  });

  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map((row) => toRecipeCard(row.recipe)),
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor({ createdAt: last.createdAt, id: last.recipeId }) : null,
  };
}

"use server";

import { setFavorite } from "@/lib/services/favorites";
import { requireUser } from "@/lib/session";
import { parseRecipeId } from "@/lib/validation/recipe";

export type SetFavoriteResult = { ok: true; favorited: boolean; count: number } | { ok: false; error: string };

/**
 * お気に入りに保存 / 解除する(F-08)。引数はブラウザから書き換えて送ることもできるので、ここで確かめる。
 * ゲスト(セッション切れを含む)はログイン画面へ移動し、ログイン後は returnTo に戻る。
 */
export async function setFavoriteAction(
  recipeId: unknown,
  favorited: unknown,
  returnTo: unknown,
): Promise<SetFavoriteResult> {
  const id = parseRecipeId(recipeId);
  const user = await requireUser(typeof returnTo === "string" ? returnTo : id ? `/recipes/${id}` : "/");
  if (id === null || typeof favorited !== "boolean") {
    return { ok: false, error: "レシピが見つかりません" };
  }

  try {
    const result = await setFavorite(user.id, id, favorited);
    if (result === "not_found") return { ok: false, error: "このレシピは削除されました" };
    return { ok: true, ...result };
  } catch (error) {
    console.error("お気に入りの更新に失敗しました", error instanceof Error ? error.message : error);
    return { ok: false, error: "保存できませんでした。時間をおいてやり直してください" };
  }
}

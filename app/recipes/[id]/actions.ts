"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteRecipe, type RecipeWriteOutcome } from "@/lib/services/recipes";
import { requireUser } from "@/lib/session";
import { deleteImageQuietly } from "@/lib/storage";
import { parseRecipeId } from "@/lib/validation/recipe";

export type DeleteRecipeState = { error?: string };

/**
 * レシピ削除(F-04)。recipeId は画面で bind した値だが、ブラウザから書き換えて送ることもできるので、
 * 画面の確認には頼らず、ここでログインと投稿者本人であることを確認する。削除できたらトップへ移動する。
 */
export async function deleteRecipeAction(recipeId: unknown): Promise<DeleteRecipeState> {
  const id = parseRecipeId(recipeId);
  const user = await requireUser(id ? `/recipes/${id}` : "/");
  if (id === null) return { error: "レシピが見つかりません。削除された可能性があります" };

  let outcome: RecipeWriteOutcome;
  try {
    outcome = await deleteRecipe(user.id, id);
  } catch (error) {
    console.error("レシピの削除に失敗しました", error instanceof Error ? error.message : error);
    return { error: "削除できませんでした。時間をおいてやり直してください" };
  }
  const { result } = outcome;
  if (result === "forbidden") {
    console.warn("他人のレシピを削除しようとしました", { userId: user.id, recipeId: id });
    return { error: "このレシピを削除する権限がありません" };
  }
  // not_found は、別のタブで先に削除した場合など。目的の状態にはなっているのでトップへ移動する

  // 完成写真のファイルも消す。失敗してもレシピの削除は完了させ、ログに残す(非機能要件)
  await deleteImageQuietly(outcome.unusedImageKey, "レシピを削除したため");

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  redirect("/");
}

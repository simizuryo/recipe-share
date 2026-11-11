"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateRecipe, type RecipeWriteResult } from "@/lib/services/recipes";
import { requireUser } from "@/lib/session";
import {
  parseRecipeId,
  readRecipeForm,
  recipeFieldErrors,
  recipeSchema,
  type RecipeFormState,
} from "@/lib/validation/recipe";

const WRITE_ERRORS: Record<Exclude<RecipeWriteResult, "ok">, string> = {
  not_found: "レシピが見つかりません。削除された可能性があります",
  forbidden: "このレシピを編集する権限がありません",
};

/**
 * レシピ編集(F-04)。recipeId は画面で bind した値だが、ブラウザから書き換えて送ることもできるので、
 * 画面の確認には頼らず、ここでログインと投稿者本人であることを確認する。
 */
export async function updateRecipeAction(
  recipeId: unknown,
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const id = parseRecipeId(recipeId);
  const user = await requireUser(id ? `/recipes/${id}/edit` : "/");

  const values = readRecipeForm(formData);
  if (id === null) return { values, errors: { form: WRITE_ERRORS.not_found } };

  const parsed = recipeSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: recipeFieldErrors(parsed.error) };
  }

  let result: RecipeWriteResult;
  try {
    result = await updateRecipe(user.id, id, parsed.data);
  } catch (error) {
    console.error("レシピの更新に失敗しました", error instanceof Error ? error.message : error);
    return { values, errors: { form: "保存できませんでした。時間をおいてやり直してください" } };
  }
  if (result !== "ok") {
    if (result === "forbidden") console.warn("他人のレシピを編集しようとしました", { userId: user.id, recipeId: id });
    return { values, errors: { form: WRITE_ERRORS[result] } };
  }

  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

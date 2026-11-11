"use server";

import { redirect } from "next/navigation";

import { createRecipe } from "@/lib/services/recipes";
import { requireUser } from "@/lib/session";
import { readRecipeForm, recipeFieldErrors, recipeSchema, type RecipeFormState } from "@/lib/validation/recipe";

/** レシピ投稿(F-03)。画面の確認とは別に、ここでもログインを確認する */
export async function createRecipeAction(_prev: RecipeFormState, formData: FormData): Promise<RecipeFormState> {
  const user = await requireUser("/recipes/new");

  const values = readRecipeForm(formData);
  const parsed = recipeSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: recipeFieldErrors(parsed.error) };
  }

  let recipeId: number;
  try {
    ({ id: recipeId } = await createRecipe(user.id, parsed.data));
  } catch (error) {
    console.error("レシピの保存に失敗しました", error instanceof Error ? error.message : error);
    return { values, errors: { form: "保存できませんでした。時間をおいてやり直してください" } };
  }

  redirect(`/recipes/${recipeId}`);
}

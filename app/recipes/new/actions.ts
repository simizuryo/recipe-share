"use server";

import { redirect } from "next/navigation";

import { createRecipe } from "@/lib/services/recipes";
import { requireUser } from "@/lib/session";
import { deleteImageQuietly, newImageKey, putImage } from "@/lib/storage";
import { readImageField } from "@/lib/validation/image";
import { readRecipeForm, recipeFieldErrors, recipeSchema, type RecipeFormState } from "@/lib/validation/recipe";

const SAVE_ERROR = "保存できませんでした。時間をおいてやり直してください";

/** レシピ投稿(F-03)。画面の確認とは別に、ここでもログインを確認する。完成写真(F-09)は任意 */
export async function createRecipeAction(_prev: RecipeFormState, formData: FormData): Promise<RecipeFormState> {
  const user = await requireUser("/recipes/new");

  const values = readRecipeForm(formData);
  const parsed = recipeSchema.safeParse(values);
  const image = await readImageField(formData);
  if (!parsed.success || !image.ok) {
    return {
      values,
      errors: {
        ...(parsed.success ? {} : recipeFieldErrors(parsed.error)),
        ...(image.ok ? {} : { image: image.error }),
      },
    };
  }

  // 写真を先にストレージへ保存し、DB にはそのキーを書く。DB への保存が失敗したら写真を消す
  let imageKey: string | null = null;
  let recipeId: number;
  try {
    if (image.upload) {
      imageKey = newImageKey(image.upload.type);
      await putImage(imageKey, image.upload.bytes, image.upload.type);
    }
    ({ id: recipeId } = await createRecipe(user.id, parsed.data, imageKey));
  } catch (error) {
    console.error("レシピの保存に失敗しました", error instanceof Error ? error.message : error);
    await deleteImageQuietly(imageKey, "レシピの保存に失敗したため");
    return { values, errors: { form: SAVE_ERROR } };
  }

  redirect(`/recipes/${recipeId}`);
}

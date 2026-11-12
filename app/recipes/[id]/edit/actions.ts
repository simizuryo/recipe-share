"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type ImageChange, updateRecipe, type RecipeWriteOutcome, type RecipeWriteResult } from "@/lib/services/recipes";
import { requireUser } from "@/lib/session";
import { deleteImageQuietly, newImageKey, putImage } from "@/lib/storage";
import { readImageField } from "@/lib/validation/image";
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
 * 完成写真(F-09)は、新しく選べば差し替え、「写真を削除」にチェックがあれば削除、どちらもなければそのまま。
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

  // 新しい写真は先にストレージへ保存する。DB の更新が失敗した・権限がなかった場合は消す
  let newKey: string | null = null;
  let outcome: RecipeWriteOutcome;
  try {
    let change: ImageChange = { type: "keep" };
    if (image.upload) {
      newKey = newImageKey(image.upload.type);
      await putImage(newKey, image.upload.bytes, image.upload.type);
      change = { type: "set", key: newKey };
    } else if (image.remove) {
      change = { type: "remove" };
    }
    outcome = await updateRecipe(user.id, id, parsed.data, change);
  } catch (error) {
    console.error("レシピの更新に失敗しました", error instanceof Error ? error.message : error);
    await deleteImageQuietly(newKey, "レシピの更新に失敗したため");
    return { values, errors: { form: "保存できませんでした。時間をおいてやり直してください" } };
  }
  const result: RecipeWriteResult = outcome.result;
  if (result !== "ok") {
    await deleteImageQuietly(newKey, `レシピを更新できなかったため(${result})`);
    if (result === "forbidden") console.warn("他人のレシピを編集しようとしました", { userId: user.id, recipeId: id });
    return { values, errors: { form: WRITE_ERRORS[result] } };
  }

  // 差し替え・削除で使われなくなった写真を消す(失敗してもログに残すだけ)
  await deleteImageQuietly(outcome.unusedImageKey, "写真を差し替え・削除したため");

  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

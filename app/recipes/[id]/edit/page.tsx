import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RecipeForm } from "@/components/recipe/recipe-form";
import { getRecipeDetail } from "@/lib/services/recipes";
import { requireUser } from "@/lib/session";
import { imageUrl } from "@/lib/validation/image";
import { parseRecipeId, recipeToFormValues } from "@/lib/validation/recipe";

import { updateRecipeAction } from "./actions";

export const metadata: Metadata = { title: "レシピを編集 | recipe-share" };

// S-05 レシピ編集(F-04)。投稿と同じフォームに、今の内容を入れて表示する
export default function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
  return (
    <main style={{ padding: "2rem 1rem 4rem", maxWidth: 720, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>レシピを編集</h1>
      <Suspense fallback={<p>読み込み中…</p>}>
        {params.then(({ id }) => (
          <EditRecipeContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function EditRecipeContent({ id: rawId }: { id: string }) {
  const id = parseRecipeId(rawId);
  if (id === null) notFound();
  // ゲストはログイン画面へ移動し、ログイン後にこの画面へ戻る(F-02)
  const user = await requireUser(`/recipes/${id}/edit`);
  const recipe = await getRecipeDetail(id);
  if (!recipe) notFound();

  // 他人のレシピは編集できない(保存時も Server Action 側で確認する)
  if (recipe.user.id !== user.id) {
    return (
      <p role="alert">
        このレシピを編集する権限がありません。<Link href={`/recipes/${id}`}>レシピに戻る</Link>
      </p>
    );
  }

  return (
    <RecipeForm
      action={updateRecipeAction.bind(null, id)}
      initialValues={recipeToFormValues(recipe)}
      submitLabel="更新する"
      currentImageUrl={recipe.imageKey ? imageUrl(recipe.imageKey) : null}
    />
  );
}

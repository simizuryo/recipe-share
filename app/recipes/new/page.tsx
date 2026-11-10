import type { Metadata } from "next";
import { Suspense } from "react";

import { RecipeForm } from "@/components/recipe/recipe-form";
import { requireUser } from "@/lib/session";

import { createRecipeAction } from "./actions";

export const metadata: Metadata = { title: "レシピを書く | recipe-share" };

// S-05 レシピ投稿(F-03)
export default function NewRecipePage() {
  return (
    <main style={{ padding: "2rem 1rem 4rem", maxWidth: 720, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>レシピを書く</h1>
      <Suspense fallback={<p>読み込み中…</p>}>
        <NewRecipeContent />
      </Suspense>
    </main>
  );
}

async function NewRecipeContent() {
  // ゲストはログイン画面へ移動し、ログイン後にこの画面へ戻る(F-02)
  await requireUser("/recipes/new");
  return <RecipeForm action={createRecipeAction} submitLabel="投稿する" />;
}

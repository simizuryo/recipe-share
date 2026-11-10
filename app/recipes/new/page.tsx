import type { Metadata } from "next";
import { Suspense } from "react";

import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "レシピを書く | recipe-share" };

// S-05 レシピ投稿。ログインが必要な画面の保護(F-02)だけ先に用意し、フォームは F-03 で作る
export default function NewRecipePage() {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>レシピを書く</h1>
      <Suspense fallback={<p style={{ marginTop: "0.5rem" }}>読み込み中…</p>}>
        <NewRecipeContent />
      </Suspense>
    </main>
  );
}

async function NewRecipeContent() {
  await requireUser("/recipes/new");
  return <p style={{ marginTop: "0.5rem" }}>投稿フォームは準備中です。</p>;
}

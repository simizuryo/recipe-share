import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoadMoreRecipes } from "@/components/recipe/load-more-recipes";
import { RecipeCard } from "@/components/recipe/recipe-card";
import listStyles from "@/components/recipe/recipe-list.module.css";
import { listFavorites } from "@/lib/services/favorites";
import { requireUser } from "@/lib/session";

import styles from "../../page.module.css";

export const metadata: Metadata = { title: "お気に入り | recipe-share" };

const PATH = "/me/favorites";

// S-07 お気に入り一覧(F-08)。本人のお気に入りだけを、保存した日時の新しい順に表示する
export default function FavoritesPage() {
  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.heading}>お気に入り</h1>
      </div>
      <Suspense fallback={<p className={listStyles.empty}>読み込み中…</p>}>
        <Favorites />
      </Suspense>
    </main>
  );
}

async function Favorites() {
  const user = await requireUser(PATH);
  const { items, nextCursor } = await listFavorites(user.id);
  const viewer = { signedIn: true, returnTo: PATH };

  if (items.length === 0) {
    return (
      <p className={listStyles.empty} role="status">
        まだお気に入りがありません。<Link href="/">レシピを探す</Link>
      </p>
    );
  }

  return (
    <>
      {/* 解除してもその場では消さない(押し間違えたときにすぐ保存し直せるように)。次に開いたときに消える */}
      <ul className={listStyles.list} aria-label="お気に入りのレシピ">
        {items.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} viewer={viewer} />
        ))}
      </ul>
      {nextCursor && (
        <LoadMoreRecipes query="" initialCursor={nextCursor} viewer={viewer} endpoint="/api/me/favorites" />
      )}
    </>
  );
}

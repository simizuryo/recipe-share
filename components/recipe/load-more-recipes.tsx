"use client";

import { useState } from "react";

import type { RecipeCard as RecipeCardData, RecipePage } from "@/lib/services/recipes";

import { type CardViewer, RecipeCard } from "./recipe-card";
import styles from "./recipe-list.module.css";

/**
 * 「もっと見る」(F-05)。押すたびに続きの 20件を endpoint(既定は /api/recipes)から読み込んで、一覧の後ろに足す。
 * お気に入り一覧(F-08)では /api/me/favorites を使う。
 * 検索条件が変わったら作り直す(呼び出し側で key に条件を渡す)。
 */
export function LoadMoreRecipes({
  query,
  initialCursor,
  viewer,
  endpoint = "/api/recipes",
}: {
  query: string;
  initialCursor: string;
  viewer: CardViewer;
  endpoint?: string;
}) {
  const [items, setItems] = useState<RecipeCardData[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams(query);
      params.set("cursor", cursor);
      const res = await fetch(`${endpoint}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = (await res.json()) as RecipePage;
      // 読み込み中に新しいレシピが投稿されてもカーソルより前は含まれないが、念のため重複は除く
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.items.filter((r) => !seen.has(r.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {items.length > 0 && (
        <ul className={styles.list} aria-label="続きのレシピ">
          {items.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} viewer={viewer} />
          ))}
        </ul>
      )}
      {error && (
        <p className={styles.error} role="alert">
          読み込めませんでした。もう一度お試しください
        </p>
      )}
      {cursor && (
        <div className={styles.more}>
          <button type="button" className={styles.moreButton} onClick={loadMore} disabled={loading}>
            {loading ? "読み込み中…" : "もっと見る"}
          </button>
        </div>
      )}
    </>
  );
}

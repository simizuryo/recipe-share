"use client";

import { useState } from "react";

import type { RecipeCard as RecipeCardData, RecipePage } from "@/lib/services/recipes";

import { RecipeCard } from "./recipe-card";
import styles from "./recipe-list.module.css";

/**
 * 「もっと見る」(F-05)。押すたびに続きの 20件を /api/recipes から読み込んで、一覧の後ろに足す。
 * 検索条件が変わったら作り直す(呼び出し側で key に条件を渡す)。
 */
export function LoadMoreRecipes({ query, initialCursor }: { query: string; initialCursor: string }) {
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
      const res = await fetch(`/api/recipes?${params}`);
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
            <RecipeCard key={recipe.id} recipe={recipe} />
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

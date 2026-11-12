import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { LoadMoreRecipes } from "@/components/recipe/load-more-recipes";
import { RecipeCard } from "@/components/recipe/recipe-card";
import listStyles from "@/components/recipe/recipe-list.module.css";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/category";
import {
  hasSearchCondition,
  MAX_MINUTES_OPTIONS,
  parseRecipeSearch,
  recipeSearchToQuery,
  type RecipeSearch,
} from "@/lib/search/recipe-search";
import { listRecipes } from "@/lib/services/recipes";
import { getCurrentUser } from "@/lib/session";

import styles from "./page.module.css";

// S-03 トップ(レシピ一覧 F-05・検索 F-07)。検索条件は URL のクエリ ?q=&category=&maxMinutes=
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className={styles.page}>
      <Suspense fallback={<p className={listStyles.empty}>読み込み中…</p>}>
        {searchParams.then((params) => (
          <RecipeResults search={parseRecipeSearch(params)} />
        ))}
      </Suspense>
    </main>
  );
}

async function RecipeResults({ search }: { search: RecipeSearch }) {
  const query = recipeSearchToQuery(search);
  const filtered = hasSearchCondition(search);
  const user = await getCurrentUser();
  const { items, nextCursor } = await listRecipes(search, null, user?.id ?? null);
  // ゲストがお気に入りボタンからログインしたら、同じ検索条件の一覧に戻す
  const viewer = { signedIn: user !== null, returnTo: query === "" ? "/" : `/?${query}` };

  return (
    <>
      <div className={styles.toolbar}>
        <h1 className={styles.heading}>{search.q !== "" ? `「${search.q}」の検索結果` : "新着レシピ"}</h1>
        <SearchFilters key={query} search={search} />
      </div>

      {items.length === 0 ? (
        <p className={listStyles.empty} role="status">
          {filtered ? "条件に合うレシピがありません" : "まだレシピがありません"}
        </p>
      ) : (
        <>
          <ul className={listStyles.list} aria-label="レシピ一覧">
            {items.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} viewer={viewer} />
            ))}
          </ul>
          {nextCursor && <LoadMoreRecipes key={query} query={query} initialCursor={nextCursor} viewer={viewer} />}
        </>
      )}
    </>
  );
}

/** カテゴリ・調理時間の絞り込み。キーワードは hidden で引き継ぐ(入力はヘッダーの検索欄) */
function SearchFilters({ search }: { search: RecipeSearch }) {
  return (
    <Form action="/" className={styles.filters} aria-label="絞り込み">
      {search.q !== "" && <input type="hidden" name="q" value={search.q} />}
      <label className={styles.filter}>
        <span>カテゴリ</span>
        <select name="category" defaultValue={search.category ?? ""} className={styles.select}>
          <option value="">すべて</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filter}>
        <span>調理時間</span>
        <select name="maxMinutes" defaultValue={search.maxMinutes ?? ""} className={styles.select}>
          <option value="">指定なし</option>
          {MAX_MINUTES_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}分以内
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={styles.apply}>
        絞り込む
      </button>
      {hasSearchCondition(search) && (
        <Link href="/" className={styles.clear}>
          条件をクリア
        </Link>
      )}
    </Form>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeleteRecipeButton } from "@/components/recipe/delete-recipe-button";
import ownerStyles from "@/components/recipe/recipe-owner-actions.module.css";
import { CATEGORY_LABELS } from "@/lib/category";
import { getRecipeDetail, type RecipeDetail } from "@/lib/services/recipes";
import { getCurrentUser } from "@/lib/session";
import { parseRecipeId } from "@/lib/validation/recipe";

import { deleteRecipeAction } from "./actions";
import styles from "./page.module.css";

/**
 * 存在しないレシピに HTTP 404 を返すため、レシピを読むまで画面を送り始めない(F-06)。
 * notFound() を <Suspense> の内側で呼ぶと、送り始めた後なのでステータスが 200 のままになる。
 * そのため、このページは静的な枠を先に送る(instant)対象から外す。
 */
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/recipes/[id]">): Promise<Metadata> {
  const id = parseRecipeId((await params).id);
  const recipe = id === null ? null : await getRecipeDetail(id);
  return { title: `${recipe ? recipe.title : "レシピが見つかりません"} | recipe-share` };
}

// S-04 レシピ詳細(F-06)。お気に入りボタン・完成写真・コメントは各機能で追加する
export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  const id = parseRecipeId((await params).id);
  if (id === null) notFound();
  const recipe = await getRecipeDetail(id);
  if (!recipe) notFound();

  // 投稿時は投稿日と更新日が同じ時刻。後になっていれば編集したレシピ
  const edited = recipe.updatedAt.getTime() > recipe.createdAt.getTime();

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← レシピ一覧へ
      </Link>
      <article>
        <h1 className={styles.title}>{recipe.title}</h1>
        <p className={styles.meta}>
          <span>by {recipe.user.name}</span>
          <span>{CATEGORY_LABELS[recipe.category]}</span>
          <span>
            <span aria-hidden>⏱</span> {recipe.cookMinutes}分
          </span>
          <span>
            <span aria-hidden>♡</span> お気に入り {recipe._count.favorites}
          </span>
        </p>
        <p className={styles.meta}>
          <span>
            投稿 <time dateTime={recipe.createdAt.toISOString()}>{formatDate(recipe.createdAt)}</time>
          </span>
          {edited && (
            <span>
              更新 <time dateTime={recipe.updatedAt.toISOString()}>{formatDate(recipe.updatedAt)}</time>
            </span>
          )}
        </p>
        {/* ログイン状態(Cookie)で変わる部分だけ、後から読み込む */}
        <Suspense fallback={null}>
          <OwnerActions recipe={recipe} />
        </Suspense>
        {recipe.description && <p className={styles.description}>{recipe.description}</p>}

        <section className={styles.section} aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading" className={styles.heading}>
            材料<span className={styles.servings}>({recipe.servings}人分)</span>
          </h2>
          <ul className={styles.ingredients}>
            {recipe.ingredients.map((row, i) => (
              <li key={i}>
                <span>{row.name}</span>
                <span className={styles.quantity}>{row.quantity}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="steps-heading">
          <h2 id="steps-heading" className={styles.heading}>
            作り方
          </h2>
          <ol className={styles.steps}>
            {recipe.steps.map((row, i) => (
              <li key={i}>{row.body}</li>
            ))}
          </ol>
        </section>
      </article>
    </main>
  );
}

/** 編集・削除は投稿者にだけ表示する(操作時も Server Action 側で確認する) */
async function OwnerActions({ recipe }: { recipe: RecipeDetail }) {
  const user = await getCurrentUser();
  if (user?.id !== recipe.user.id) return null;
  return (
    <div className={ownerStyles.actions}>
      <Link href={`/recipes/${recipe.id}/edit`} className={ownerStyles.secondary}>
        編集
      </Link>
      <DeleteRecipeButton title={recipe.title} action={deleteRecipeAction.bind(null, recipe.id)} />
    </div>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium" }).format(date);
}

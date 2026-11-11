import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeleteRecipeButton } from "@/components/recipe/delete-recipe-button";
import ownerStyles from "@/components/recipe/recipe-owner-actions.module.css";
import { CATEGORY_LABELS } from "@/lib/category";
import { getRecipeDetail } from "@/lib/services/recipes";
import { getCurrentUser } from "@/lib/session";
import { parseRecipeId } from "@/lib/validation/recipe";

import { deleteRecipeAction } from "./actions";
import styles from "./page.module.css";

// S-04 レシピ詳細(F-06)。写真・お気に入り・コメントは各機能で追加する
export default function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  return (
    <main className={styles.page}>
      <Suspense fallback={<p>読み込み中…</p>}>
        {params.then(({ id }) => (
          <RecipeContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function RecipeContent({ id: rawId }: { id: string }) {
  const id = parseRecipeId(rawId);
  if (id === null) notFound();
  const [recipe, user] = await Promise.all([getRecipeDetail(id), getCurrentUser()]);
  if (!recipe) notFound();

  const isOwner = user?.id === recipe.user.id;
  // 投稿時は投稿日と更新日が同じ時刻。後になっていれば編集したレシピ
  const edited = recipe.updatedAt.getTime() > recipe.createdAt.getTime();

  return (
    <article>
      <title>{`${recipe.title} | recipe-share`}</title>
      <h1 className={styles.title}>{recipe.title}</h1>
      <p className={styles.meta}>
        <span>by {recipe.user.name}</span>
        <span>{CATEGORY_LABELS[recipe.category]}</span>
        <span>{recipe.cookMinutes}分</span>
        <span>
          投稿 <time dateTime={recipe.createdAt.toISOString()}>{formatDate(recipe.createdAt)}</time>
        </span>
        {edited && (
          <span>
            更新 <time dateTime={recipe.updatedAt.toISOString()}>{formatDate(recipe.updatedAt)}</time>
          </span>
        )}
      </p>
      {/* 編集・削除は投稿者にだけ表示する(操作時も Server Action 側で確認する) */}
      {isOwner && (
        <div className={ownerStyles.actions}>
          <Link href={`/recipes/${id}/edit`} className={ownerStyles.secondary}>
            編集
          </Link>
          <DeleteRecipeButton title={recipe.title} action={deleteRecipeAction.bind(null, id)} />
        </div>
      )}
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
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium" }).format(date);
}

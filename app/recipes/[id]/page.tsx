import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CATEGORY_LABELS } from "@/lib/category";
import { getRecipeDetail } from "@/lib/services/recipes";

import styles from "./page.module.css";

// S-04 レシピ詳細(F-06)。写真・お気に入り・編集削除・コメントは各機能で追加する
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

async function RecipeContent({ id }: { id: string }) {
  if (!/^[1-9][0-9]{0,9}$/.test(id) || Number(id) > 2_147_483_647) notFound();
  const recipe = await getRecipeDetail(Number(id));
  if (!recipe) notFound();

  return (
    <article>
      <title>{`${recipe.title} | recipe-share`}</title>
      <h1 className={styles.title}>{recipe.title}</h1>
      <p className={styles.meta}>
        <span>by {recipe.user.name}</span>
        <span>{CATEGORY_LABELS[recipe.category]}</span>
        <span>{recipe.cookMinutes}分</span>
        <time dateTime={recipe.createdAt.toISOString()}>{formatDate(recipe.createdAt)}</time>
      </p>
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

import Link from "next/link";

import { CATEGORY_LABELS } from "@/lib/category";
import type { RecipeCard as RecipeCardData } from "@/lib/services/recipes";

import styles from "./recipe-card.module.css";

/**
 * 一覧のカード1枚(F-05)。サーバーで描画する最初の 20件と、「もっと見る」で読み込んだ分の両方で使う。
 * 完成写真は F-09 で表示する。それまでは(写真がないレシピも)代わりの画像を出す。
 */
export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  return (
    <li>
      <Link href={`/recipes/${recipe.id}`} className={styles.card}>
        <div className={styles.thumb} data-category={recipe.category} aria-hidden>
          <span>{CATEGORY_LABELS[recipe.category]}</span>
        </div>
        <div className={styles.body}>
          <h2 className={styles.title}>{recipe.title}</h2>
          <p className={styles.meta}>
            <span className={styles.author}>{recipe.authorName}</span>
            <span>
              <span aria-hidden>⏱</span>
              <span className={styles.srOnly}>調理時間</span> {recipe.cookMinutes}分
            </span>
          </p>
          <p className={styles.meta}>
            <span>
              <span aria-hidden>♡</span>
              <span className={styles.srOnly}>お気に入り</span> {recipe.favoriteCount}
            </span>
          </p>
        </div>
      </Link>
    </li>
  );
}

import Image from "next/image";
import Link from "next/link";

import { CATEGORY_LABELS } from "@/lib/category";
import type { RecipeCard as RecipeCardData } from "@/lib/services/recipes";
import { imageUrl } from "@/lib/validation/image";

import { FavoriteButton } from "./favorite-button";
import styles from "./recipe-card.module.css";

/** カードを見ている人。お気に入りボタン(F-08)に使う */
export type CardViewer = {
  signedIn: boolean;
  /** ゲストがお気に入りボタンからログインした後に戻る画面 */
  returnTo: string;
};

/**
 * 一覧のカード1枚(F-05)。サーバーで描画する最初の 20件と、「もっと見る」で読み込んだ分の両方で使う。
 * 完成写真(F-09)は next/image で表示幅に合わせて縮小した画像を使う。写真がないレシピはカテゴリ名の代わりの画像を出す。
 * リンクの中にボタンは置けないので、リンクは料理名だけにして、CSS でカード全体を押せるように広げる。
 * お気に入りボタンはその上に重ねる。
 */
export function RecipeCard({ recipe, viewer }: { recipe: RecipeCardData; viewer: CardViewer }) {
  return (
    <li className={styles.card}>
      <div className={styles.thumb} data-category={recipe.category} aria-hidden>
        {recipe.imageKey ? (
          <Image
            src={imageUrl(recipe.imageKey)}
            alt=""
            fill
            sizes="(max-width: 520px) 110px, (max-width: 900px) 50vw, 300px"
            className={styles.photo}
          />
        ) : (
          <span>{CATEGORY_LABELS[recipe.category]}</span>
        )}
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>
          <Link href={`/recipes/${recipe.id}`} className={styles.link}>
            {recipe.title}
          </Link>
        </h2>
        <p className={styles.meta}>
          <span className={styles.author}>{recipe.authorName}</span>
          <span>
            <span aria-hidden>⏱</span>
            <span className={styles.srOnly}>調理時間</span> {recipe.cookMinutes}分
          </span>
        </p>
        <div className={styles.actions}>
          <FavoriteButton
            recipeId={recipe.id}
            favorited={recipe.favorited}
            count={recipe.favoriteCount}
            signedIn={viewer.signedIn}
            returnTo={viewer.returnTo}
            size="small"
          />
        </div>
      </div>
    </li>
  );
}

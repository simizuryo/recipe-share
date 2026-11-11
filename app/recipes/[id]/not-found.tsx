import Link from "next/link";

import styles from "./page.module.css";

// 存在しない・削除済みのレシピ(F-06)。編集画面 /recipes/:id/edit でも使われる
export default function RecipeNotFound() {
  return (
    <main className={styles.page}>
      {/* metadata を書き出せるのはルートの not-found だけなので、<title> を直接置く */}
      <title>レシピが見つかりません | recipe-share</title>
      <h1 className={styles.title}>レシピが見つかりません</h1>
      <p className={styles.description}>削除されたか、URL が間違っている可能性があります。</p>
      <p className={styles.section}>
        <Link href="/" className={styles.back}>
          ← レシピ一覧へ
        </Link>
      </p>
    </main>
  );
}

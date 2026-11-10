import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser } from "@/lib/session";

import { GuestLinks } from "./guest-links";
import styles from "./header.module.css";
import { UserMenu } from "./user-menu";

/**
 * 全画面共通のヘッダー(docs/requirements/04-screen-design.md)。
 * ロゴと検索欄は静的に描画し、ログイン状態で変わる部分だけ <Suspense> の内側で読み込む。
 */
export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          recipe-share
        </Link>
        <Form action="/" className={styles.search} role="search">
          <input
            type="search"
            name="q"
            placeholder="料理名・材料で検索"
            aria-label="レシピを検索"
            className={styles.searchInput}
            maxLength={50}
          />
        </Form>
        <Suspense fallback={<div className={styles.nav} aria-hidden />}>
          <HeaderNav />
        </Suspense>
      </div>
    </header>
  );
}

async function HeaderNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <nav className={styles.nav} aria-label="アカウント">
        <GuestLinks />
      </nav>
    );
  }
  return (
    <nav className={styles.nav} aria-label="メニュー">
      <Link href="/recipes/new" className={styles.primary}>
        レシピを書く
      </Link>
      <Link href="/me/favorites" className={styles.link}>
        お気に入り
      </Link>
      <UserMenu username={user.username} name={user.name} />
    </nav>
  );
}

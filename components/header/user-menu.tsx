import Link from "next/link";

import { signOut } from "@/app/actions/auth";

import styles from "./header.module.css";

/** ログイン中のメニュー(ユーザーページ・プロフィール編集・ログアウト)。JavaScript なしでも開閉できる */
export function UserMenu({ username, name }: { username: string; name: string }) {
  return (
    <details className={styles.menu}>
      <summary className={styles.menuButton}>{name}</summary>
      <ul className={styles.menuList}>
        <li>
          <Link href={`/users/${username}`} className={styles.menuItem}>
            ユーザーページ
          </Link>
        </li>
        <li>
          <Link href="/me/profile" className={styles.menuItem}>
            プロフィール編集
          </Link>
        </li>
        <li>
          <form action={signOut}>
            <button type="submit" className={styles.menuItem}>
              ログアウト
            </button>
          </form>
        </li>
      </ul>
    </details>
  );
}

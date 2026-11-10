"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { loginUrl, safeNextPath, signupUrl } from "@/lib/auth-redirect";

import styles from "./header.module.css";

/** ゲスト向けのリンク。ログイン・登録の後は今いる画面に戻る */
export function GuestLinks() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const current = safeNextPath(query ? `${pathname}?${query}` : pathname);

  return (
    <>
      <Link href={loginUrl(current)} className={styles.link}>
        ログイン
      </Link>
      <Link href={signupUrl(current)} className={styles.primary}>
        新規登録
      </Link>
    </>
  );
}

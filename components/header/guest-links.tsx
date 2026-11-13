"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { loginUrl, returnToFromLocation, signupUrl } from "@/lib/auth-redirect";

import styles from "./header.module.css";

/** ゲスト向けのリンク。ログイン・登録の後は今いる画面に戻る(ログイン・登録画面では、その画面の戻り先を引き継ぐ) */
export function GuestLinks() {
  const current = returnToFromLocation(usePathname(), useSearchParams());

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

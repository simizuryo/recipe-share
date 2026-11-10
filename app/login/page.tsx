import type { Metadata } from "next";
import { Suspense } from "react";

import styles from "@/components/auth/auth-form.module.css";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン | recipe-share" };

// S-01 ログイン(F-02)
export default function LoginPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>ログイン</h1>
      {/* ?next= を読むため、フォームはリクエスト時に描画する */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}

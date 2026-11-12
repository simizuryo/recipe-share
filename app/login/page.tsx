import type { Metadata } from "next";
import { Suspense } from "react";

import styles from "@/components/auth/auth-form.module.css";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン | recipe-share" };

// S-01 ログイン(F-02)
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>ログイン</h1>
      {/* ?next= とログイン状態を読むため、フォームはリクエスト時に描画する */}
      <Suspense>
        <RedirectIfSignedIn searchParams={searchParams} />
        <LoginForm />
      </Suspense>
    </main>
  );
}

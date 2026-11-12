import type { Metadata } from "next";
import { Suspense } from "react";

import styles from "@/components/auth/auth-form.module.css";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "ユーザー登録 | recipe-share" };

// S-02 ユーザー登録(F-01)
export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>ユーザー登録</h1>
      {/* ?next= とログイン状態を読むため、フォームはリクエスト時に描画する */}
      <Suspense>
        <RedirectIfSignedIn searchParams={searchParams} />
        <SignUpForm />
      </Suspense>
    </main>
  );
}

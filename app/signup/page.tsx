import type { Metadata } from "next";
import { Suspense } from "react";

import styles from "@/components/auth/auth-form.module.css";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "ユーザー登録 | recipe-share" };

// S-02 ユーザー登録(F-01)
export default function SignUpPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>ユーザー登録</h1>
      {/* ?next= を読むため、フォームはリクエスト時に描画する */}
      <Suspense>
        <SignUpForm />
      </Suspense>
    </main>
  );
}

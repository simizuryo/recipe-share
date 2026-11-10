"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import styles from "@/components/auth/auth-form.module.css";
import { authClient } from "@/lib/auth-client";
import { safeNextPath, signupUrl } from "@/lib/auth-redirect";

const INVALID_CREDENTIALS = "メールアドレスまたはパスワードが違います";

/**
 * ログイン(F-02)。
 * Better Auth のレート制限(1分 10回)は /api/auth を通ったときに効くため、
 * Server Action ではなくブラウザから /api/auth/sign-in/email を呼ぶ。
 */
export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(
          error.status === 429
            ? "ログインの試行が多すぎます。1分ほど待ってからやり直してください"
            : error.status === 400 || error.status === 401
              ? INVALID_CREDENTIALS
              : "ログインできませんでした。時間をおいてやり直してください",
        );
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <>
      {/* JavaScript の読み込み前に送信されても、パスワードが URL(GET のクエリ)に載らないよう POST にしておく */}
      <form method="post" onSubmit={handleSubmit} className={styles.form} noValidate>
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            メールアドレス
          </label>
          <input id="email" name="email" type="email" className={styles.input} autoComplete="email" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "ログインしています…" : "ログイン"}
        </button>
      </form>

      <p className={styles.switch}>
        はじめての方は{" "}
        <Link href={signupUrl(next)}>新規登録</Link>
      </p>
    </>
  );
}

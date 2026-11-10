"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import styles from "@/components/auth/auth-form.module.css";
import { loginUrl, safeNextPath } from "@/lib/auth-redirect";

import { signUp, type SignUpState } from "./actions";

const initialState: SignUpState = {};

export function SignUpForm() {
  const next = safeNextPath(useSearchParams().get("next"));
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const errors = state.errors ?? {};

  return (
    <>
      <form action={formAction} className={styles.form} noValidate>
        <input type="hidden" name="next" value={next} />
        {errors.form && (
          <p className={styles.formError} role="alert">
            {errors.form[0]}
          </p>
        )}

        <Field
          id="username"
          label="ユーザー名"
          hint="半角英数字と _ で 3〜20 文字。あとから変更できません"
          error={errors.username?.[0]}
        >
          <input
            id="username"
            name="username"
            className={styles.input}
            defaultValue={state.values?.username}
            autoComplete="username"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]{3,20}"
            aria-invalid={!!errors.username}
            aria-describedby="username-hint username-error"
          />
        </Field>

        <Field id="name" label="表示名" hint="20 文字以内" error={errors.name?.[0]}>
          <input
            id="name"
            name="name"
            className={styles.input}
            defaultValue={state.values?.name}
            autoComplete="nickname"
            required
            maxLength={20}
            aria-invalid={!!errors.name}
            aria-describedby="name-hint name-error"
          />
        </Field>

        <Field id="email" label="メールアドレス" error={errors.email?.[0]}>
          <input
            id="email"
            name="email"
            type="email"
            className={styles.input}
            defaultValue={state.values?.email}
            autoComplete="email"
            required
            maxLength={255}
            aria-invalid={!!errors.email}
            aria-describedby="email-error"
          />
        </Field>

        <Field id="password" label="パスワード" hint="8〜72 文字" error={errors.password?.[0]}>
          <input
            id="password"
            name="password"
            type="password"
            className={styles.input}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-invalid={!!errors.password}
            aria-describedby="password-hint password-error"
          />
        </Field>

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "登録しています…" : "登録する"}
        </button>
      </form>

      <p className={styles.switch}>
        登録済みの方は{" "}
        <Link href={loginUrl(next)}>ログイン</Link>
      </p>
    </>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

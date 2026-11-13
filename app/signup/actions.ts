"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth-redirect";
import { findTakenSignUpFields } from "@/lib/services/users";
import { signUpSchema, type SignUpField } from "@/lib/validation/auth";
import { logger } from "@/lib/logger";

export type SignUpState = {
  /** エラー時に入力欄へ戻す値(パスワードは戻さない) */
  values?: { username: string; name: string; email: string };
  errors?: Partial<Record<SignUpField | "form", string[]>>;
};

const TAKEN_MESSAGES = {
  username: "このユーザー名は既に使われています",
  email: "このメールアドレスは既に登録されています",
} as const;

/** ユーザー登録(F-01)。成功したらそのままログイン状態にして移動する */
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const raw = {
    username: String(formData.get("username") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { username: raw.username, name: raw.name, email: raw.email };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;

  const takenErrors = await checkTaken(input.username, input.email);
  if (takenErrors) return { values, errors: takenErrors };

  try {
    // nextCookies プラグインがセッション Cookie を書き込む(autoSignIn: true)
    await auth.api.signUpEmail({
      body: { username: input.username, name: input.name, email: input.email, password: input.password },
      headers: await headers(),
    });
  } catch (error) {
    // 確認と登録の間に同じユーザー名・メールアドレスで登録された場合
    const raceErrors = await checkTaken(input.username, input.email);
    if (raceErrors) return { values, errors: raceErrors };
    // 入力値(パスワード)はログに出さない
    logger.error("ユーザー登録に失敗しました", { error });
    return { values, errors: { form: ["登録できませんでした。時間をおいてやり直してください"] } };
  }

  redirect(safeNextPath(formData.get("next")));
}

async function checkTaken(username: string, email: string): Promise<SignUpState["errors"] | null> {
  const taken = await findTakenSignUpFields(username, email);
  if (!taken.username && !taken.email) return null;
  return {
    ...(taken.username && { username: [TAKEN_MESSAGES.username] }),
    ...(taken.email && { email: [TAKEN_MESSAGES.email] }),
  };
}

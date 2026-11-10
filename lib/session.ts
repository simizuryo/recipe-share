import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { loginUrl } from "@/lib/auth-redirect";

/** 画面や Server Actions が使うログイン中のユーザー。セッションの中身(トークンなど)は渡さない */
export type CurrentUser = {
  id: number;
  username: string;
  name: string;
};

/**
 * ログイン中のユーザーを返す。ゲストなら null。
 * Cookie を読むため、呼び出す Server Component は <Suspense> の内側に置く。
 * 1回のリクエストの中では結果を使い回す(ヘッダーと画面本体で2回 DB を引かない)。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, username, name } = session.user;
  return { id: Number(id), username, name };
});

/**
 * ログインが必要な画面・操作で使う。ゲストならログイン画面へ移動し、ログイン後は returnTo へ戻る(F-02)。
 * Server Actions でも、画面側の確認に頼らず必ずこれで確認する。
 */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(returnTo));
  return user;
}

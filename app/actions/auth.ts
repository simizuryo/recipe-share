"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/** ログアウト(F-02)。ログアウト後もレシピの閲覧・検索は続けられるよう、トップへ移動する */
export async function signOut(): Promise<void> {
  // nextCookies プラグインがセッション Cookie を削除する。セッションが無くてもエラーにしない
  await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
  redirect("/");
}

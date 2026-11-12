import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth-redirect";
import { getCurrentUser } from "@/lib/session";

type Props = {
  /** ページの searchParams。?next= があればそこへ、なければトップへ移動する */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * ログイン・登録画面(S-01/S-02)に置く。ログイン中なら画面を出さずに戻り先へ移動する。
 * Cookie と searchParams を読むため <Suspense> の内側に置く。何も描画しない。
 */
export async function RedirectIfSignedIn({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) {
    const { next } = await searchParams;
    redirect(safeNextPath(typeof next === "string" ? next : undefined));
  }
  return null;
}

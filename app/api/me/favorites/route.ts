import { connection } from "next/server";
import type { NextRequest } from "next/server";

import { decodeCursor } from "@/lib/search/recipe-search";
import { listFavorites } from "@/lib/services/favorites";
import { getCurrentUser } from "@/lib/session";

/**
 * お気に入り一覧の「もっと見る」(F-08 / S-07)。本人の分だけを返すので、ログインが必要。
 * GET /api/me/favorites?cursor=「保存日時_レシピ ID」
 */
export async function GET(request: NextRequest) {
  await connection();
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "ログインしてください" }, { status: 401 });
  }
  const cursor = decodeCursor(request.nextUrl.searchParams.get("cursor"));
  if (!cursor) {
    return Response.json({ error: "cursor が正しくありません" }, { status: 400 });
  }

  try {
    return Response.json(await listFavorites(user.id, cursor));
  } catch (error) {
    console.error("お気に入り一覧の取得に失敗しました", error instanceof Error ? error.message : error);
    return Response.json({ error: "読み込めませんでした" }, { status: 500 });
  }
}

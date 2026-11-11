import { connection, type NextRequest } from "next/server";

import { decodeCursor, parseRecipeSearch } from "@/lib/search/recipe-search";
import { listRecipes } from "@/lib/services/recipes";

/**
 * 「もっと見る」で続きのレシピを返す(F-05 / F-07)。ゲストも使える。
 * GET /api/recipes?q=&category=&maxMinutes=&cursor=
 */
export async function GET(request: NextRequest) {
  // ビルド時に事前レンダリングされないよう、リクエストのたびに実行する
  await connection();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const cursor = decodeCursor(params.cursor);
  if (!cursor) {
    return Response.json({ error: "cursor が正しくありません" }, { status: 400 });
  }

  try {
    return Response.json(await listRecipes(parseRecipeSearch(params), cursor));
  } catch (error) {
    console.error("レシピ一覧の取得に失敗しました", error instanceof Error ? error.message : error);
    return Response.json({ error: "読み込めませんでした" }, { status: 500 });
  }
}

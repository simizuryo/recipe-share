import type { Instrumentation } from "next";

import { logger } from "@/lib/logger";

/**
 * 想定外のエラー(Server Components の描画・Route Handler・Server Actions で捕まえられなかったもの)をログに残す。
 * 画面には Next.js のエラー表示が出て、詳細はここで記録したサーバーのログにだけ残る(非機能要件)。
 * リクエストのヘッダー(Cookie を含む)と、クエリ文字列は書き出さない。
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logger.error("リクエストの処理中に想定外のエラーが発生しました", {
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    error,
  });
};

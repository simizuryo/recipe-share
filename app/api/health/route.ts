import { connection } from "next/server";

import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

/** 動作確認用: アプリが動いていて DB に接続できるかを返す */
export async function GET() {
  // ビルド時に事前レンダリングされて DB へ接続しに行かないよう、リクエストのたびに実行する
  await connection();
  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok" });
  } catch (error) {
    logger.error("ヘルスチェック: DB に接続できません", { error });
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}

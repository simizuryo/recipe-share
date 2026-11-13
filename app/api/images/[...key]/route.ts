import { connection, type NextRequest } from "next/server";

import { getImage } from "@/lib/storage";
import { isImageKey } from "@/lib/validation/image";
import { logger } from "@/lib/logger";

/**
 * 完成写真を返す(F-09)。ゲストも見られる。
 * GET /api/images/recipes/<UUID>.<拡張子>
 * バケットは非公開のまま、ここでストレージから読み出して返す。写真は差し替えるたびに新しいキーになるので、長くキャッシュしてよい。
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/images/[...key]">) {
  await connection();
  const key = (await params).key.join("/");
  if (!isImageKey(key)) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const image = await getImage(key);
    if (!image) return new Response("Not Found", { status: 404 });
    return new Response(image.body, {
      headers: {
        "Content-Type": image.contentType,
        ...(image.contentLength !== undefined && { "Content-Length": String(image.contentLength) }),
        "Cache-Control": "public, max-age=31536000, immutable",
        // 保存時に中身を確かめているが、念のためブラウザに形式を推測させない
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    logger.error("写真の読み出しに失敗しました", { key, error });
    return new Response("Internal Server Error", { status: 500 });
  }
}

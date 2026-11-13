import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // 完成写真(F-09)は /api/images/ から配信する。それ以外のパス・クエリ付きの URL は最適化しない
    localPatterns: [{ pathname: "/api/images/**", search: "" }],
  },
  experimental: {
    serverActions: {
      // 完成写真(4MB まで)をフォームと一緒に Server Action で受け取るため、上限を少し大きくする。
      // 写真 4MB + フォームの文字(最大でも数十KB)が収まる値。本番の Vercel ではリクエスト本体が 4.5MB までに制限される
      bodySizeLimit: "4.5mb",
    },
    // 開発用の Turbopack のファイルキャッシュ(再起動の間も残る)を使わない。
    // 有効だと、開発サーバーの再起動後にブラウザの再読み込みが止まらなくなることがあった(Issue #23)
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;

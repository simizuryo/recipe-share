import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 開発用の Turbopack のファイルキャッシュ(再起動の間も残る)を使わない。
    // 有効だと、開発サーバーの再起動後にブラウザの再読み込みが止まらなくなることがあった(Issue #23)
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;

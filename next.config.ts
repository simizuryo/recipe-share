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
      // 完成写真(5MB まで)をフォームと一緒に Server Action で受け取るため、上限を少し大きくする
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;

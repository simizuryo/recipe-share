import path from "node:path";

import { defineConfig } from "vitest/config";

import { TEST_DATABASE_URL } from "./tests/support/test-database";

/**
 * 統合テスト(service 層を本物の PostgreSQL につないで確かめる)。
 *   npm run test:integration
 * 接続先は TEST_DATABASE_URL(既定は docker-compose の PostgreSQL の recipe_share_test データベース)。
 * 開発用の recipe_share とは別のデータベースなので、テストのたびに中身を消しても開発中のデータは消えない。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // server-only はサーバーの外で読み込むとエラーにするパッケージ。テストでは空のモジュールに置き換える
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    env: { DATABASE_URL: TEST_DATABASE_URL, LOG_LEVEL: "silent" },
    globalSetup: ["tests/support/integration-global-setup.ts"],
    setupFiles: ["tests/support/integration-setup.ts"],
    // 全ファイルが同じデータベースを使うので、1ファイルずつ順番に実行する
    fileParallelism: false,
  },
});

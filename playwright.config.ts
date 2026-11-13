import { defineConfig, devices } from "@playwright/test";

import { E2E_DATABASE_URL } from "./tests/support/test-database";

/**
 * E2E テスト(ブラウザで画面を操作して、投稿 → 検索 → お気に入りの流れを確かめる)。手元で実行する。
 *   docker compose up -d
 *   npm run test:e2e
 * アプリは本番と同じ形(next build → next start)でポート 3100 に起動する。開発サーバー(3000)とは別に動く。
 * データベースは recipe_share_e2e_test、写真のバケットは recipe-share-e2e を使い、開発用のデータには触らない。
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/** アプリに渡す環境変数(.env より優先される) */
export const E2E_ENV = {
  DATABASE_URL: E2E_DATABASE_URL,
  BETTER_AUTH_URL: BASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-secret-at-least-32-characters-long!!",
  S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? "http://localhost:9200",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: process.env.E2E_S3_ACCESS_KEY_ID ?? "recipe-dev",
  S3_SECRET_ACCESS_KEY: process.env.E2E_S3_SECRET_ACCESS_KEY ?? "recipe-dev-secret",
  S3_BUCKET: "recipe-share-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "tests/e2e",
  // 1つのデータベースを共有するので、1つずつ順番に動かす
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    // サーバーは globalSetup(データベースの用意)より先に起動するので、DB を使わない URL で起動を待つ
    url: `${BASE_URL}/favicon.ico`,
    env: E2E_ENV,
    // 古いビルドのサーバーを使い回さない
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

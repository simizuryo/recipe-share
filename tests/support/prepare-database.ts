import { execFileSync } from "node:child_process";
import path from "node:path";

import { assertTestDatabase } from "./test-database";

/**
 * テスト用データベースの準備。Prisma CLI だけで行う
 * (Playwright は設定・globalSetup を CommonJS として読み込むため、import.meta を使う生成済みの Prisma Client を読み込めない)。
 * npm スクリプト(Vitest・Playwright)はリポジトリ直下で動くので、そこを基準にする。
 */
const PRISMA_CLI = path.join(process.cwd(), "node_modules/prisma/build/index.js");

/** マイグレーション履歴以外の全テーブルを空にして、ID を 1 から振り直す SQL */
export const TRUNCATE_ALL_TABLES_SQL = `
DO $$
DECLARE tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO tables
  FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations';
  IF tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;`;

function prisma(url: string, args: string[], input?: string): void {
  execFileSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "inherit", "inherit"],
  });
}

/** テスト用データベースにマイグレーションを当てる(データベースがなければ prisma migrate deploy が作る) */
export function prepareTestDatabase(url: string): void {
  assertTestDatabase(url);
  prisma(url, ["migrate", "deploy"]);
}

/** テスト用データベースの全テーブルを空にする */
export function truncateTestDatabase(url: string): void {
  assertTestDatabase(url);
  prisma(url, ["db", "execute", "--stdin"], TRUNCATE_ALL_TABLES_SQL);
}

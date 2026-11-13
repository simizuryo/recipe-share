import { afterAll, beforeEach } from "vitest";

import { getDb } from "@/lib/db";

import { TRUNCATE_ALL_TABLES_SQL } from "./prepare-database";
import { assertTestDatabase } from "./test-database";

assertTestDatabase(process.env.DATABASE_URL ?? "");

// テストごとに全テーブルを空にする(前のテストのデータに左右されないように)
beforeEach(async () => {
  await getDb().$executeRawUnsafe(TRUNCATE_ALL_TABLES_SQL);
});

afterAll(async () => {
  await getDb().$disconnect();
});

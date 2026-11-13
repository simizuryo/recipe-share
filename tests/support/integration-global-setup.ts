import { prepareTestDatabase } from "./prepare-database";
import { TEST_DATABASE_URL } from "./test-database";

/** 統合テストの前に1回だけ動く。テスト用データベースを用意する(テストごとの中身の削除は integration-setup.ts) */
export default function setup() {
  prepareTestDatabase(TEST_DATABASE_URL);
}

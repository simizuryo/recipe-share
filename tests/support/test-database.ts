/** 統合テストの接続先(既定は docker-compose の PostgreSQL の recipe_share_test データベース) */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://recipe:recipe@localhost:5434/recipe_share_test";

/** E2E テストでアプリが使う接続先。統合テストと同時に動かしても互いのデータを消さないよう、別のデータベースにする */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://recipe:recipe@localhost:5434/recipe_share_e2e_test";

/** データベース名が _test で終わらなければ止める(開発用・本番のデータベースの中身を消さないため) */
export function assertTestDatabase(url: string): string {
  const name = new URL(url).pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`テスト用のデータベース名は _test で終わる必要があります(今: ${name || "なし"})`);
  }
  return name;
}

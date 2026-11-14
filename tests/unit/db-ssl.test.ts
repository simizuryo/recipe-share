import { describe, expect, it } from "vitest";

import { SUPABASE_ROOT_CA_2021, sslOptionsFor } from "@/lib/db-ssl";

describe("sslOptionsFor", () => {
  it("Supabase のプーラーには Supabase の認証局で検証する設定を返す", () => {
    const options = sslOptionsFor(
      "postgresql://postgres.ref:pw@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres",
    );
    expect(options).toEqual({ ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true });
  });

  it("Supabase の直接接続(*.supabase.co)も検証する", () => {
    expect(sslOptionsFor("postgresql://postgres:pw@db.ref.supabase.co:5432/postgres")).toMatchObject({
      rejectUnauthorized: true,
    });
  });

  it("ローカルの DB では TLS を使わない", () => {
    expect(sslOptionsFor("postgresql://recipe:recipe@localhost:5434/recipe_share")).toBeUndefined();
  });

  it("supabase.com で終わるだけの別ドメインは対象にしない", () => {
    expect(sslOptionsFor("postgresql://u:p@evilsupabase.com:5432/db")).toBeUndefined();
  });

  it("読めない接続文字列では undefined を返す", () => {
    expect(sslOptionsFor("not a url")).toBeUndefined();
  });

  it("証明書は PEM 形式の1件", () => {
    expect(SUPABASE_ROOT_CA_2021.match(/BEGIN CERTIFICATE/g)).toHaveLength(1);
    expect(SUPABASE_ROOT_CA_2021.trim().endsWith("-----END CERTIFICATE-----")).toBe(true);
  });
});

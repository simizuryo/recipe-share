import { describe, expect, it } from "vitest";

import { loginUrl, returnToFromLocation, safeNextPath, signupUrl } from "@/lib/auth-redirect";
import { signUpSchema } from "@/lib/validation/auth";

const valid = {
  username: "taro_01",
  name: "たろう",
  email: "Taro@Example.com",
  password: "password1",
};

function fieldErrors(input: Record<string, string>) {
  const result = signUpSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("signUpSchema", () => {
  it("正しい入力を受け付け、メールアドレスを小文字にそろえる", () => {
    const result = signUpSchema.parse({ ...valid, name: "  たろう  " });
    expect(result.email).toBe("taro@example.com");
    expect(result.name).toBe("たろう");
  });

  it.each([
    ["ab", false],
    ["abc", true],
    ["a".repeat(20), true],
    ["a".repeat(21), false],
    ["taro-01", false],
    ["たろう", false],
  ])("ユーザー名 %s → 受け付ける: %s", (username, ok) => {
    expect(signUpSchema.safeParse({ ...valid, username }).success).toBe(ok);
  });

  it.each([
    ["", false],
    ["   ", false],
    ["あ".repeat(20), true],
    ["あ".repeat(21), false],
  ])("表示名 %j → 受け付ける: %s", (name, ok) => {
    expect(signUpSchema.safeParse({ ...valid, name }).success).toBe(ok);
  });

  it.each([
    ["1234567", false],
    ["12345678", true],
    ["a".repeat(72), true],
    ["a".repeat(73), false],
  ])("パスワード長 %s → 受け付ける: %s", (password, ok) => {
    expect(signUpSchema.safeParse({ ...valid, password }).success).toBe(ok);
  });

  it("メールアドレスの形式が違うと、その項目にエラーを返す", () => {
    expect(fieldErrors({ ...valid, email: "not-an-email" })).toEqual({
      email: "メールアドレスの形式が正しくありません",
    });
  });
});

describe("safeNextPath", () => {
  it.each(["/", "/recipes/new", "/recipes/1/edit?x=1#top", "/?q=カレー"])("サイト内のパス %s はそのまま返す", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["recipes"],
    ["/login"],
    ["/login?next=/x"],
    ["/signup"],
    ["/a\nb"],
  ])("危険・不要な値 %j は / にする", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("/loginx のように名前が似ているだけのパスは通す", () => {
    expect(safeNextPath("/loginx")).toBe("/loginx");
  });
});

describe("returnToFromLocation", () => {
  const at = (pathname: string, query = "") => returnToFromLocation(pathname, new URLSearchParams(query));

  it("ふつうの画面では、今いるパスとクエリを返す", () => {
    expect(at("/recipes/1")).toBe("/recipes/1");
    expect(at("/", "q=カレー&category=MAIN")).toBe("/?q=%E3%82%AB%E3%83%AC%E3%83%BC&category=MAIN");
  });

  it("ログイン・登録画面では、その画面の next を引き継ぐ", () => {
    expect(at("/login", "next=/recipes/1")).toBe("/recipes/1");
    expect(at("/signup", "next=%2Fme%2Ffavorites")).toBe("/me/favorites");
    expect(signupUrl(at("/login", "next=/recipes/1"))).toBe("/signup?next=%2Frecipes%2F1");
    expect(loginUrl(at("/signup", "next=/recipes/1"))).toBe("/login?next=%2Frecipes%2F1");
  });

  it("ログイン・登録画面で next がない・不正なら / にする", () => {
    expect(at("/login")).toBe("/");
    expect(at("/login", "next=https://evil.example")).toBe("/");
    expect(at("/signup", "next=/login?next=/x")).toBe("/");
  });

  it("名前が似ているだけの画面は、ふつうの画面として扱う", () => {
    expect(at("/loginx", "next=/recipes/1")).toBe("/loginx?next=%2Frecipes%2F1");
  });
});

describe("loginUrl / signupUrl", () => {
  it("戻り先をクエリに入れる", () => {
    expect(loginUrl("/recipes/new")).toBe("/login?next=%2Frecipes%2Fnew");
    expect(signupUrl("/me/favorites")).toBe("/signup?next=%2Fme%2Ffavorites");
  });

  it("戻り先がトップか不正なら付けない", () => {
    expect(loginUrl("/")).toBe("/login");
    expect(signupUrl("https://evil.example")).toBe("/signup");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { formatLogLine, logger, sanitize } from "@/lib/logger";

const NOW = new Date("2026-11-13T01:02:03.000Z");

describe("formatLogLine", () => {
  it("time・level・msg を先頭に置いた JSON 1行にする", () => {
    const line = formatLogLine("info", "保存しました", { userId: 1, recipeId: 2 }, NOW);
    expect(line).not.toContain("\n");
    expect(line).toBe(
      '{"time":"2026-11-13T01:02:03.000Z","level":"info","msg":"保存しました","userId":1,"recipeId":2}',
    );
  });

  it("fields の time・level・msg で上書きされない", () => {
    const parsed = JSON.parse(formatLogLine("error", "本物", { level: "debug", msg: "偽物", time: "x" }, NOW));
    expect(parsed).toMatchObject({ level: "error", msg: "本物", time: NOW.toISOString() });
  });
});

describe("sanitize(秘密の値を伏せる)", () => {
  it.each([
    "password",
    "newPassword",
    "currentPassword",
    "token",
    "sessionToken",
    "session_token",
    "accessToken",
    "secret",
    "BETTER_AUTH_SECRET",
    "S3_SECRET_ACCESS_KEY",
    "cookie",
    "set-cookie",
    "Authorization",
    "apiKey",
    "api_key",
    "x-api-key",
    "credentials",
  ])("キー %s の値は [REDACTED] になる", (key) => {
    expect(sanitize({ [key]: "hunter2-value" })).toEqual({ [key]: "[REDACTED]" });
  });

  it("入れ子・配列の中でも伏せる", () => {
    const line = formatLogLine(
      "warn",
      "x",
      { body: { email: "a@example.test", password: "hunter2-value" }, list: [{ token: "tok-value" }] },
      NOW,
    );
    expect(line).not.toContain("hunter2-value");
    expect(line).not.toContain("tok-value");
    expect(JSON.parse(line).body).toEqual({ email: "a@example.test", password: "[REDACTED]" });
  });

  it("秘密でないキー(userId・recipeId・key・reason など)はそのまま", () => {
    const fields = { userId: 1, recipeId: 2, key: "recipes/a.jpg", reason: "削除", username: "taro" };
    expect(sanitize(fields)).toEqual(fields);
  });

  it("Error は name・message・stack・code・cause を書き出す", () => {
    const cause = new Error("接続が切れました");
    const error = Object.assign(new Error("保存に失敗", { cause }), { code: "P2002" });
    const out = sanitize({ error }) as { error: Record<string, unknown> };
    expect(out.error).toMatchObject({ name: "Error", message: "保存に失敗", code: "P2002" });
    expect(out.error.stack).toEqual(expect.stringContaining("保存に失敗"));
    expect(out.error.cause).toMatchObject({ message: "接続が切れました" });
  });

  it("循環参照・BigInt・Date があっても JSON にできる", () => {
    const a: Record<string, unknown> = { n: BigInt(10), at: NOW };
    a.self = a;
    const parsed = JSON.parse(formatLogLine("info", "x", { a }, NOW));
    expect(parsed.a).toEqual({ n: "10", at: NOW.toISOString(), self: "[Circular]" });
  });
});

describe("logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("error・warn は標準エラー、info は標準出力に1行で書く", () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.error("e");
    logger.warn("w");
    logger.info("i");
    expect(err).toHaveBeenCalledTimes(2);
    expect(out).toHaveBeenCalledTimes(1);
    expect(JSON.parse(err.mock.calls[0][0] as string)).toMatchObject({ level: "error", msg: "e" });
  });

  it("LOG_LEVEL より低いレベルは書かない", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("i");
    logger.debug("d");
    logger.warn("w");
    expect(out).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=silent なら何も書かない", () => {
    vi.stubEnv("LOG_LEVEL", "silent");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("e");
    expect(err).not.toHaveBeenCalled();
  });
});

/**
 * サーバーのログ。1件を JSON 1行で書き出す(Vercel のログ画面で検索・絞り込みしやすくするため)。
 *
 *   logger.error("レシピの保存に失敗しました", { userId, error })
 *   → {"time":"…","level":"error","msg":"レシピの保存に失敗しました","userId":1,"error":{"name":"Error","message":"…","stack":"…"}}
 *
 * - パスワード・トークン・Cookie などのキーは値を伏せる(非機能要件「パスワード・セッショントークンはログに出さない」)。
 *   キー名で判断するので、秘密の値は「password」「token」など分かる名前で渡すこと。
 * - Error は name / message / stack(と digest・code・cause)にして書き出す。
 * - 出力するレベルは環境変数 LOG_LEVEL(debug / info / warn / error / silent、既定は info)。
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel | "silent", number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

/** 値を伏せるキー(大文字・小文字、区切りの - と _ は区別しない) */
const SENSITIVE_KEY = /pass(word|wd)?|secret|token|cookie|authorization|api[-_]?key|credential/i;
const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;

/** ログに書き出せる形にする。秘密のキーを伏せ、Error を展開し、循環参照・深すぎる入れ子を止める */
export function sanitize(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (typeof value !== "object") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) return "[Truncated]";
  seen.add(value);

  if (value instanceof Error) {
    const out: LogFields = { name: value.name, message: value.message, stack: value.stack };
    const extra = value as Error & { digest?: unknown; code?: unknown };
    if (extra.digest !== undefined) out.digest = sanitize(extra.digest, depth + 1, seen);
    if (extra.code !== undefined) out.code = sanitize(extra.code, depth + 1, seen);
    if (value.cause !== undefined) out.cause = sanitize(value.cause, depth + 1, seen);
    return out;
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1, seen));

  const out: LogFields = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitize(item, depth + 1, seen);
  }
  return out;
}

function currentLevel(): LogLevel | "silent" {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  return level && level in LEVEL_ORDER ? (level as LogLevel | "silent") : "info";
}

/** 1行分の JSON を作る(テストから使う) */
export function formatLogLine(level: LogLevel, msg: string, fields: LogFields = {}, now: Date = new Date()): string {
  // time・level・msg を先頭に置き、fields の同じ名前のキーで上書きされないようにする
  const rest = sanitize(fields) as LogFields;
  for (const key of ["time", "level", "msg"]) delete rest[key];
  return JSON.stringify({ time: now.toISOString(), level, msg, ...rest });
}

function write(level: LogLevel, msg: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;
  let line: string;
  try {
    line = formatLogLine(level, msg, fields);
  } catch {
    // ログのせいで処理を止めない
    line = JSON.stringify({ time: new Date().toISOString(), level, msg, logError: "fields を書き出せませんでした" });
  }
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => write("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
};

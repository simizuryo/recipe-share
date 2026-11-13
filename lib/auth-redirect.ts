/**
 * ログイン後に戻る先(?next=)を、このサイト内のパスだけに制限する。
 * 外部サイトへ飛ばされる(オープンリダイレクト)のを防ぐため、次のものは "/" に置き換える。
 * - "/" で始まらないもの(https://evil.example など)
 * - "//" や "/\" で始まるもの(ブラウザが別のホストとして扱う)
 * - 制御文字やバックスラッシュを含むもの
 * - ログイン・登録画面そのもの(戻ってもまたログイン画面になるため)
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2000) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  if (/^\/(login|signup)(?=$|[/?#])/.test(value)) return "/";
  return value;
}

/**
 * ヘッダーのログイン・登録リンクに付ける戻り先。今いる画面(パス + クエリ)を返す。
 * ただし今いるのがログイン・登録画面なら、その画面の ?next= を引き継ぐ
 * (ログイン画面から登録画面へ移っても、登録後に元の画面へ戻れるように)。
 */
export function returnToFromLocation(pathname: string, search: URLSearchParams): string {
  if (/^\/(login|signup)\/?$/.test(pathname)) return safeNextPath(search.get("next"));
  const query = search.toString();
  return safeNextPath(query ? `${pathname}?${query}` : pathname);
}

/** ログイン画面の URL。ログイン後に returnTo へ戻る */
export function loginUrl(returnTo: string): string {
  return withNext("/login", returnTo);
}

/** ユーザー登録画面の URL。登録後に returnTo へ戻る */
export function signupUrl(returnTo: string): string {
  return withNext("/signup", returnTo);
}

function withNext(path: string, returnTo: string): string {
  const next = safeNextPath(returnTo);
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}

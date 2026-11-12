import type { Prisma } from "@/lib/generated/prisma/client";
import { Category } from "@/lib/generated/prisma/enums";

/** 調理時間の絞り込みの選択肢(F-07)。未選択は「指定なし」 */
export const MAX_MINUTES_OPTIONS = [15, 30, 60] as const;
export type MaxMinutes = (typeof MAX_MINUTES_OPTIONS)[number];

/** キーワードの上限(検索欄の maxLength と同じ文字数・語数) */
export const MAX_QUERY_LENGTH = 50;
export const MAX_KEYWORDS = 5;

/** 一覧・検索の1回の件数(F-05) */
export const PAGE_SIZE = 20;

/** 一覧・検索の条件。URL のクエリ ?q=&category=&maxMinutes= から作る */
export type RecipeSearch = {
  /** 検索欄に戻す入力そのまま(前後の空白は除く) */
  q: string;
  /** q をスペースで区切った語(重複なし)。すべてを含むレシピに絞る */
  keywords: string[];
  category: Category | null;
  maxMinutes: MaxMinutes | null;
};

type SearchParamValue = string | string[] | undefined;

/** 同じ名前のクエリが複数あるときは最初の値を使う */
function first(value: SearchParamValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * URL のクエリを検索条件にする。おかしな値は「指定なし」として扱い、エラーにはしない
 * (URL を手で書き換えられても画面が壊れないように)。
 */
export function parseRecipeSearch(params: Record<string, SearchParamValue>): RecipeSearch {
  const q = first(params.q).trim().slice(0, MAX_QUERY_LENGTH);
  // \s は全角スペース(U+3000)も含む
  const keywords = [...new Set(q.split(/\s+/).filter((w) => w !== ""))].slice(0, MAX_KEYWORDS);

  const categoryParam = first(params.category).toUpperCase();
  const category = (Object.values(Category) as string[]).includes(categoryParam) ? (categoryParam as Category) : null;

  const minutes = Number(first(params.maxMinutes));
  const maxMinutes = (MAX_MINUTES_OPTIONS as readonly number[]).includes(minutes) ? (minutes as MaxMinutes) : null;

  return { q, keywords, category, maxMinutes };
}

/** 条件が1つでも指定されているか(「条件に合うレシピがありません」と「まだレシピがありません」を分けるため) */
export function hasSearchCondition(search: RecipeSearch): boolean {
  return search.keywords.length > 0 || search.category !== null || search.maxMinutes !== null;
}

/** 検索条件を URL のクエリ文字列にする(空の条件は含めない)。先頭の "?" は付けない */
export function recipeSearchToQuery(search: RecipeSearch): string {
  const params = new URLSearchParams();
  if (search.q !== "") params.set("q", search.q);
  if (search.category) params.set("category", search.category);
  if (search.maxMinutes) params.set("maxMinutes", String(search.maxMinutes));
  return params.toString();
}

/**
 * 検索条件を Prisma の where にする(F-07)。条件はすべて AND。
 * キーワードは1語ごとに「料理名 または 材料名 に含まれる」で、大文字・小文字を区別しない(ILIKE。pg_trgm の GIN インデックスが効く)。
 * Prisma の contains は LIKE の % と _ をワイルドカードのまま渡すので、escapeLike で文字として扱う。
 */
export function buildRecipeWhere(search: RecipeSearch): Prisma.RecipeWhereInput {
  const and: Prisma.RecipeWhereInput[] = search.keywords.map(escapeLike).map((keyword) => ({
    OR: [
      { title: { contains: keyword, mode: "insensitive" } },
      { ingredients: { some: { name: { contains: keyword, mode: "insensitive" } } } },
    ],
  }));
  if (search.category) and.push({ category: search.category });
  if (search.maxMinutes) and.push({ cookMinutes: { lte: search.maxMinutes } });
  return and.length > 0 ? { AND: and } : {};
}

/**
 * LIKE / ILIKE の特別な文字(% と _ と、エスケープに使うバックスラッシュ)の前にバックスラッシュを付けて、
 * ただの文字として検索させる。例: 「100%」は「100% を含む」になり、「100 を含む」にはならない。
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * 「もっと見る」の続きの位置。新着順(作成日時の降順、同じ時刻は ID の降順)で、最後に表示したレシピを指す。
 * URL に載せるので「ISO 8601 の日時_ID」の文字列にする。
 */
export type RecipeCursor = { createdAt: Date; id: number };

export function encodeCursor(cursor: RecipeCursor): string {
  return `${cursor.createdAt.toISOString()}_${cursor.id}`;
}

/** 読めないカーソルは null */
export function decodeCursor(value: string | null | undefined): RecipeCursor | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([1-9][0-9]{0,9})$/.exec(value ?? "");
  if (!match) return null;
  const createdAt = new Date(match[1]);
  const id = Number(match[2]);
  if (Number.isNaN(createdAt.getTime()) || id > 2_147_483_647) return null;
  return { createdAt, id };
}

/** カーソルより後(古い)のレシピだけにする条件 */
export function afterCursorWhere(cursor: RecipeCursor): Prisma.RecipeWhereInput {
  return {
    OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
  };
}

/**
 * お気に入り一覧(F-08)で、カーソルより後(先に保存した)ものだけにする条件。
 * お気に入り一覧のカーソルは「保存日時_レシピ ID」(同じ形式の文字列を使い回す)。
 */
export function afterFavoriteCursorWhere(cursor: RecipeCursor): Prisma.FavoriteWhereInput {
  return {
    OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, recipeId: { lt: cursor.id } }],
  };
}

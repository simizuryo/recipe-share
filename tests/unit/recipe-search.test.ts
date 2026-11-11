import { describe, expect, it } from "vitest";

import {
  afterCursorWhere,
  buildRecipeWhere,
  decodeCursor,
  encodeCursor,
  escapeLike,
  hasSearchCondition,
  MAX_KEYWORDS,
  MAX_QUERY_LENGTH,
  parseRecipeSearch,
  recipeSearchToQuery,
} from "@/lib/search/recipe-search";

describe("parseRecipeSearch", () => {
  it("条件がなければすべて「指定なし」", () => {
    expect(parseRecipeSearch({})).toEqual({ q: "", keywords: [], category: null, maxMinutes: null });
  });

  it("キーワードは半角・全角スペースで区切り、重複は除く", () => {
    const search = parseRecipeSearch({ q: "  卵　玉ねぎ  卵 " });
    expect(search.q).toBe("卵　玉ねぎ  卵");
    expect(search.keywords).toEqual(["卵", "玉ねぎ"]);
  });

  it(`キーワードは ${MAX_QUERY_LENGTH} 文字・${MAX_KEYWORDS} 語まで`, () => {
    expect(parseRecipeSearch({ q: "あ".repeat(80) }).q).toHaveLength(MAX_QUERY_LENGTH);
    expect(parseRecipeSearch({ q: "a b c d e f g" }).keywords).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("カテゴリは決まった値だけ受け付ける(大文字・小文字は問わない)", () => {
    expect(parseRecipeSearch({ category: "MAIN" }).category).toBe("MAIN");
    expect(parseRecipeSearch({ category: "dessert" }).category).toBe("DESSERT");
    expect(parseRecipeSearch({ category: "DRINK" }).category).toBeNull();
    expect(parseRecipeSearch({ category: "" }).category).toBeNull();
  });

  it("調理時間は 15 / 30 / 60 だけ受け付ける", () => {
    expect(parseRecipeSearch({ maxMinutes: "15" }).maxMinutes).toBe(15);
    expect(parseRecipeSearch({ maxMinutes: "60" }).maxMinutes).toBe(60);
    for (const bad of ["20", "0", "-15", "abc", "15.0x", ""]) {
      expect(parseRecipeSearch({ maxMinutes: bad }).maxMinutes).toBeNull();
    }
  });

  it("同じ名前のクエリが複数あるときは最初の値を使う", () => {
    expect(parseRecipeSearch({ q: ["卵", "牛乳"], category: ["SOUP", "MAIN"] })).toMatchObject({
      keywords: ["卵"],
      category: "SOUP",
    });
  });
});

describe("hasSearchCondition / recipeSearchToQuery", () => {
  it("条件なしは空のクエリ", () => {
    const search = parseRecipeSearch({});
    expect(hasSearchCondition(search)).toBe(false);
    expect(recipeSearchToQuery(search)).toBe("");
  });

  it("指定した条件だけを URL のクエリにする(読み直すと同じ条件になる)", () => {
    const search = parseRecipeSearch({ q: "卵 玉ねぎ", category: "main", maxMinutes: "30" });
    expect(hasSearchCondition(search)).toBe(true);
    const query = recipeSearchToQuery(search);
    expect(query).toBe("q=%E5%8D%B5+%E7%8E%89%E3%81%AD%E3%81%8E&category=MAIN&maxMinutes=30");
    expect(parseRecipeSearch(Object.fromEntries(new URLSearchParams(query)))).toEqual(search);
  });

  it("空白だけのキーワードは条件なし", () => {
    expect(hasSearchCondition(parseRecipeSearch({ q: "　 " }))).toBe(false);
  });
});

describe("buildRecipeWhere", () => {
  it("条件なしは絞り込まない", () => {
    expect(buildRecipeWhere(parseRecipeSearch({}))).toEqual({});
  });

  it("キーワードごとに「料理名 または 材料名」を大文字・小文字を区別せず探し、すべてを AND でつなぐ", () => {
    const where = buildRecipeWhere(parseRecipeSearch({ q: "卵 Egg" }));
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { title: { contains: "卵", mode: "insensitive" } },
            { ingredients: { some: { name: { contains: "卵", mode: "insensitive" } } } },
          ],
        },
        {
          OR: [
            { title: { contains: "Egg", mode: "insensitive" } },
            { ingredients: { some: { name: { contains: "Egg", mode: "insensitive" } } } },
          ],
        },
      ],
    });
  });

  it("キーワードの % と _ はワイルドカードではなく文字として探す", () => {
    const where = buildRecipeWhere(parseRecipeSearch({ q: "100%" }));
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { title: { contains: "100\\%", mode: "insensitive" } },
            { ingredients: { some: { name: { contains: "100\\%", mode: "insensitive" } } } },
          ],
        },
      ],
    });
  });

  it("カテゴリと調理時間(以内)も AND で加える", () => {
    expect(buildRecipeWhere(parseRecipeSearch({ category: "SOUP", maxMinutes: "15" }))).toEqual({
      AND: [{ category: "SOUP" }, { cookMinutes: { lte: 15 } }],
    });
  });
});

describe("escapeLike", () => {
  it.each([
    ["卵", "卵"],
    ["100%", "100\\%"],
    ["a_b", "a\\_b"],
    ["C:\\path", "C:\\\\path"],
    ["%_\\", "\\%\\_\\\\"],
  ])("%j → %j", (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});

describe("カーソル", () => {
  const cursor = { createdAt: new Date("2026-11-10T13:57:27.120Z"), id: 12 };

  it("文字列にして読み戻すと同じ値になる", () => {
    expect(encodeCursor(cursor)).toBe("2026-11-10T13:57:27.120Z_12");
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each([[""], [null], [undefined], ["abc"], ["2026-11-10T13:57:27.120Z"], ["2026-11-10T13:57:27.120Z_0"], ["2026-13-45T99:99:99.999Z_1"], ["2026-11-10T13:57:27.120Z_9999999999"]])(
    "%j は読めないカーソルとして null",
    (value) => {
      expect(decodeCursor(value)).toBeNull();
    },
  );

  it("カーソルより古いもの、同じ時刻なら ID が小さいものに絞る", () => {
    expect(afterCursorWhere(cursor)).toEqual({
      OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: 12 } }],
    });
  });
});

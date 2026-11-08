import { describe, expect, it } from "vitest";

import { CATEGORIES, CATEGORY_LABELS } from "@/lib/category";

describe("カテゴリ", () => {
  it("要件定義書の6種類が、決めた順番で並ぶ", () => {
    expect(CATEGORIES.map((c) => CATEGORY_LABELS[c])).toEqual([
      "主菜",
      "副菜",
      "汁物",
      "主食",
      "デザート",
      "その他",
    ]);
  });
});

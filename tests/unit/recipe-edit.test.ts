import { describe, expect, it } from "vitest";

import { parseRecipeId, recipeSchema, recipeToFormValues } from "@/lib/validation/recipe";

describe("recipeToFormValues", () => {
  const saved = {
    id: 3,
    title: "豚の生姜焼き",
    description: null,
    servings: 2,
    cookMinutes: 15,
    category: "MAIN",
    ingredients: [
      { name: "豚ロース薄切り", quantity: "200g" },
      { name: "しょうが", quantity: "" },
    ],
    steps: [{ body: "焼く" }, { body: "たれを絡める" }],
  };

  it("保存済みのレシピをフォームの値(文字列)にし、材料・手順の順番を保つ", () => {
    expect(recipeToFormValues(saved)).toEqual({
      title: "豚の生姜焼き",
      description: "",
      servings: "2",
      cookMinutes: "15",
      category: "MAIN",
      ingredients: [
        { name: "豚ロース薄切り", quantity: "200g" },
        { name: "しょうが", quantity: "" },
      ],
      steps: [{ body: "焼く" }, { body: "たれを絡める" }],
    });
  });

  it("変換した値は、そのまま送信しても入力チェックを通る", () => {
    expect(recipeSchema.safeParse(recipeToFormValues(saved)).success).toBe(true);
  });
});

describe("parseRecipeId", () => {
  it.each([
    ["1", 1],
    ["42", 42],
    [42, 42],
    ["2147483647", 2_147_483_647],
  ])("%j → %j", (input, expected) => {
    expect(parseRecipeId(input)).toBe(expected);
  });

  it.each([["0"], ["-1"], ["01"], ["1.5"], ["abc"], [""], ["2147483648"], [1.5], [null], [undefined], [{}]])(
    "%j は不正な ID として null",
    (input) => {
      expect(parseRecipeId(input)).toBeNull();
    },
  );
});

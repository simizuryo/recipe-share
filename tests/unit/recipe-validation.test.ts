import { describe, expect, it } from "vitest";

import {
  MAX_INGREDIENTS,
  MAX_STEPS,
  readRecipeForm,
  recipeFieldErrors,
  recipeSchema,
  type RecipeFormValues,
} from "@/lib/validation/recipe";

const valid: RecipeFormValues = {
  title: "豚の生姜焼き",
  description: "",
  servings: "2",
  cookMinutes: "15",
  category: "MAIN",
  ingredients: [
    { name: "豚ロース薄切り", quantity: "200g" },
    { name: "しょうが", quantity: "" },
  ],
  steps: [{ body: "玉ねぎを薄切りにする" }, { body: "焼く" }],
};

function errorsOf(values: RecipeFormValues) {
  const result = recipeSchema.safeParse(values);
  return result.success ? {} : recipeFieldErrors(result.error);
}

describe("recipeSchema", () => {
  it("正しい入力を受け付け、数値を整数に変換する", () => {
    const result = recipeSchema.parse(valid);
    expect(result.servings).toBe(2);
    expect(result.cookMinutes).toBe(15);
    expect(result.ingredients[1]).toEqual({ name: "しょうが", quantity: "" });
  });

  it.each([
    ["", "料理名を入力してください"],
    ["   ", "料理名を入力してください"],
    ["あ".repeat(51), "料理名は 50 文字以内にしてください"],
  ])("料理名 %j はエラー", (title, message) => {
    expect(errorsOf({ ...valid, title })).toEqual({ title: message });
  });

  it.each([
    ["servings", "0"],
    ["servings", "21"],
    ["servings", "1.5"],
    ["servings", "abc"],
    ["servings", ""],
    ["cookMinutes", "0"],
    ["cookMinutes", "601"],
  ] as const)("%s = %j はエラー", (key, value) => {
    expect(Object.keys(errorsOf({ ...valid, [key]: value }))).toEqual([key]);
  });

  it.each([
    ["servings", "1"],
    ["servings", "20"],
    ["cookMinutes", "1"],
    ["cookMinutes", "600"],
  ] as const)("%s = %j(境界値)は受け付ける", (key, value) => {
    expect(errorsOf({ ...valid, [key]: value })).toEqual({});
  });

  it("カテゴリが一覧にない値ならエラー", () => {
    expect(errorsOf({ ...valid, category: "" })).toEqual({ category: "カテゴリを選んでください" });
    expect(errorsOf({ ...valid, category: "DRINK" })).toEqual({ category: "カテゴリを選んでください" });
  });

  it("材料・手順が 0 行ならエラー", () => {
    expect(errorsOf({ ...valid, ingredients: [], steps: [] })).toEqual({
      ingredients: "材料を 1 つ以上入力してください",
      steps: "手順を 1 つ以上入力してください",
    });
  });

  it("行数の上限を超えるとエラー、上限ちょうどは受け付ける", () => {
    const ing = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `材料${i}`, quantity: "" }));
    const st = (n: number) => Array.from({ length: n }, (_, i) => ({ body: `手順${i}` }));
    expect(errorsOf({ ...valid, ingredients: ing(MAX_INGREDIENTS), steps: st(MAX_STEPS) })).toEqual({});
    expect(Object.keys(errorsOf({ ...valid, ingredients: ing(MAX_INGREDIENTS + 1), steps: st(MAX_STEPS + 1) }))).toEqual([
      "ingredients",
      "steps",
    ]);
  });

  it("行ごとのエラーは行番号つきのキーで返す", () => {
    const errors = errorsOf({
      ...valid,
      ingredients: [{ name: "塩", quantity: "" }, { name: "", quantity: "少々" }, { name: "あ".repeat(31), quantity: "" }],
      steps: [{ body: "あ".repeat(301) }],
    });
    expect(errors).toEqual({
      "ingredients.1.name": "材料名を入力してください",
      "ingredients.2.name": "材料名は 30 文字以内にしてください",
      "steps.0.body": "手順は 300 文字以内にしてください",
    });
  });
});

describe("readRecipeForm", () => {
  it("同じ name の欄を画面の並び順のまま行にし、空の行は取り除く", () => {
    const fd = new FormData();
    fd.set("title", "カレー");
    fd.set("servings", "4");
    fd.set("cookMinutes", "40");
    fd.set("category", "MAIN");
    for (const [name, quantity] of [["玉ねぎ", "2個"], ["", ""], ["", "少々"], ["カレールー", "1箱"]]) {
      fd.append("ingredientName", name);
      fd.append("ingredientQuantity", quantity);
    }
    for (const body of ["切る", "  ", "煮る"]) fd.append("stepBody", body);

    const values = readRecipeForm(fd);
    expect(values.description).toBe("");
    expect(values.ingredients).toEqual([
      { name: "玉ねぎ", quantity: "2個" },
      { name: "", quantity: "少々" },
      { name: "カレールー", quantity: "1箱" },
    ]);
    expect(values.steps).toEqual([{ body: "切る" }, { body: "煮る" }]);
  });

  it("改行(CRLF・CR)を LF にそろえる", () => {
    const fd = new FormData();
    fd.set("description", "1行目\r\n2行目\r3行目");
    fd.append("stepBody", "混ぜる\r\n焼く");
    const values = readRecipeForm(fd);
    expect(values.description).toBe("1行目\n2行目\n3行目");
    expect(values.steps).toEqual([{ body: "混ぜる\n焼く" }]);
  });

  it("改行を含む 300 文字の手順は、CRLF で届いても上限内として受け付ける", () => {
    const fd = new FormData();
    fd.append("stepBody", "あ".repeat(149) + "\r\n" + "い".repeat(150));
    const { steps } = readRecipeForm(fd);
    expect(steps[0].body).toHaveLength(300);
    expect(recipeSchema.shape.steps.safeParse(steps).success).toBe(true);
  });
});

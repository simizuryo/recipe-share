import { z } from "zod";

import { Category } from "@/lib/generated/prisma/enums";

/** 材料・手順の行数の上限(F-03) */
export const MAX_INGREDIENTS = 50;
export const MAX_STEPS = 30;

/** フォームの数値欄は文字列で届くので、空欄は未入力として扱ってから整数に変換する */
function intField(label: string, min: number, max: number, unit: string) {
  return z
    .string()
    .trim()
    .min(1, `${label}を入力してください`)
    .pipe(
      z.coerce
        .number<string>({ error: `${label}は数字で入力してください` })
        .int(`${label}は整数で入力してください`)
        .min(min, `${label}は ${min}〜${max}${unit}にしてください`)
        .max(max, `${label}は ${min}〜${max}${unit}にしてください`),
    );
}

const ingredientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "材料名を入力してください")
    .max(30, "材料名は 30 文字以内にしてください"),
  quantity: z.string().trim().max(20, "分量は 20 文字以内にしてください"),
});

const stepSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "手順を入力してください")
    .max(300, "手順は 300 文字以内にしてください"),
});

/** レシピ投稿・編集の入力(F-03 / F-04) */
export const recipeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "料理名を入力してください")
    .max(50, "料理名は 50 文字以内にしてください"),
  description: z.string().trim().max(300, "説明は 300 文字以内にしてください"),
  servings: intField("分量", 1, 20, "人分"),
  cookMinutes: intField("調理時間", 1, 600, "分"),
  category: z.enum(Category, { error: "カテゴリを選んでください" }),
  ingredients: z
    .array(ingredientSchema)
    .min(1, "材料を 1 つ以上入力してください")
    .max(MAX_INGREDIENTS, `材料は ${MAX_INGREDIENTS} 行までにしてください`),
  steps: z
    .array(stepSchema)
    .min(1, "手順を 1 つ以上入力してください")
    .max(MAX_STEPS, `手順は ${MAX_STEPS} ステップまでにしてください`),
});

export type RecipeInput = z.output<typeof recipeSchema>;

/** フォームの生の値(入力欄にそのまま戻せる形) */
export type RecipeFormValues = {
  title: string;
  description: string;
  servings: string;
  cookMinutes: string;
  category: string;
  ingredients: { name: string; quantity: string }[];
  steps: { body: string }[];
};

/**
 * FormData を読む。材料・手順は同じ name の欄が画面の並び順に入っているので、その順番で行にする。
 * 材料名・分量がどちらも空の行、空の手順は、入力し忘れた余りの行として取り除く。
 */
export function readRecipeForm(formData: FormData): RecipeFormValues {
  // ブラウザはフォーム送信時に改行を CRLF にするので、LF にそろえる(文字数の数え方を入力欄と合わせるため)
  const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n") : "");
  const all = (name: string) => formData.getAll(name).map(text);
  const names = all("ingredientName");
  const quantities = all("ingredientQuantity");
  return {
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    servings: text(formData.get("servings")),
    cookMinutes: text(formData.get("cookMinutes")),
    category: text(formData.get("category")),
    ingredients: names
      .map((name, i) => ({ name, quantity: quantities[i] ?? "" }))
      .filter((row) => row.name.trim() !== "" || row.quantity.trim() !== ""),
    steps: all("stepBody")
      .map((body) => ({ body }))
      .filter((row) => row.body.trim() !== ""),
  };
}

/**
 * Zod のエラーを「項目のパス → 最初のメッセージ」にする。
 * 例: { title: "...", "ingredients.2.name": "...", steps: "..." }
 */
export function recipeFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

import { getDb } from "@/lib/db";
import type { RecipeInput } from "@/lib/validation/recipe";

let seq = 0;

/** テスト用のユーザーを作る(ログインはしないので、パスワードの行は作らない) */
export async function createUser(name = `user${++seq}`) {
  return getDb().user.create({
    data: { username: name, name, email: `${name}@example.test` },
    select: { id: true, username: true, name: true },
  });
}

/** 入力チェックを通った後の形のレシピ入力 */
export function recipeInput(overrides: Partial<RecipeInput> = {}): RecipeInput {
  return {
    title: "豚の生姜焼き",
    description: "",
    servings: 2,
    cookMinutes: 15,
    category: "MAIN",
    ingredients: [
      { name: "豚ロース薄切り", quantity: "200g" },
      { name: "しょうが", quantity: "1かけ" },
    ],
    steps: [{ body: "豚肉を焼く" }, { body: "たれを絡める" }],
    ...overrides,
  };
}

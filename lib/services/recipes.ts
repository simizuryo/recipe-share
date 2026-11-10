import "server-only";

import { getDb } from "@/lib/db";
import type { RecipeInput } from "@/lib/validation/recipe";

/**
 * レシピを材料・手順と一緒に保存する(F-03)。
 * ネストした create は1つのトランザクションで実行されるため、途中で失敗するとどれも保存されない。
 * 材料・手順の position は入力の順番(0始まり)。
 */
export async function createRecipe(userId: number, input: RecipeInput): Promise<{ id: number }> {
  return getDb().recipe.create({
    data: {
      userId,
      title: input.title,
      description: input.description === "" ? null : input.description,
      servings: input.servings,
      cookMinutes: input.cookMinutes,
      category: input.category,
      ingredients: {
        create: input.ingredients.map((row, position) => ({ position, name: row.name, quantity: row.quantity })),
      },
      steps: {
        create: input.steps.map((row, position) => ({ position, body: row.body })),
      },
    },
    select: { id: true },
  });
}

/** レシピ詳細(F-06)。見つからなければ null */
export async function getRecipeDetail(id: number) {
  return getDb().recipe.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      servings: true,
      cookMinutes: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, username: true, name: true } },
      ingredients: { orderBy: { position: "asc" }, select: { name: true, quantity: true } },
      steps: { orderBy: { position: "asc" }, select: { body: true } },
    },
  });
}

export type RecipeDetail = NonNullable<Awaited<ReturnType<typeof getRecipeDetail>>>;

import { describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";
import { decodeCursor, PAGE_SIZE, parseRecipeSearch } from "@/lib/search/recipe-search";
import { createRecipe, deleteRecipe, getRecipeDetail, listRecipes, updateRecipe } from "@/lib/services/recipes";

import { createUser, recipeInput } from "../support/factories";

const db = () => getDb();

describe("createRecipe(F-03)", () => {
  it("材料・手順を入力の順番で保存し、投稿日と更新日をそろえる", async () => {
    const user = await createUser();
    const { id } = await createRecipe(user.id, recipeInput({ description: "" }), "recipes/a.jpg");

    const detail = await getRecipeDetail(id);
    expect(detail).toMatchObject({
      title: "豚の生姜焼き",
      description: null,
      imageKey: "recipes/a.jpg",
      user: { id: user.id },
      ingredients: [
        { name: "豚ロース薄切り", quantity: "200g" },
        { name: "しょうが", quantity: "1かけ" },
      ],
      steps: [{ body: "豚肉を焼く" }, { body: "たれを絡める" }],
      _count: { favorites: 0 },
    });
    expect(detail?.updatedAt.getTime()).toBe(detail?.createdAt.getTime());
  });

  it("途中で失敗したら何も保存しない(材料名が長すぎて DB の制約に反する)", async () => {
    const user = await createUser();
    const tooLong = "あ".repeat(1000);
    await expect(
      createRecipe(user.id, recipeInput({ ingredients: [{ name: "ok", quantity: "" }, { name: tooLong, quantity: "" }] })),
    ).rejects.toThrow();
    expect(await db().recipe.count()).toBe(0);
    expect(await db().ingredient.count()).toBe(0);
  });
});

describe("updateRecipe(F-04)", () => {
  it("本人なら内容・材料・手順を入れ替え、更新日を進める", async () => {
    const owner = await createUser();
    const { id } = await createRecipe(owner.id, recipeInput());
    const before = await getRecipeDetail(id);

    const outcome = await updateRecipe(
      owner.id,
      id,
      recipeInput({
        title: "鶏の照り焼き",
        ingredients: [{ name: "鶏もも肉", quantity: "1枚" }],
        steps: [{ body: "皮目から焼く" }, { body: "たれを煮詰める" }, { body: "切る" }],
      }),
    );
    expect(outcome).toEqual({ result: "ok", unusedImageKey: null });

    const after = await db().recipe.findUniqueOrThrow({
      where: { id },
      include: { ingredients: { orderBy: { position: "asc" } }, steps: { orderBy: { position: "asc" } } },
    });
    expect(after.title).toBe("鶏の照り焼き");
    expect(after.ingredients.map((i) => [i.position, i.name])).toEqual([[0, "鶏もも肉"]]);
    expect(after.steps.map((s) => [s.position, s.body])).toEqual([
      [0, "皮目から焼く"],
      [1, "たれを煮詰める"],
      [2, "切る"],
    ]);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before!.createdAt.getTime());
  });

  it("他人のレシピは forbidden を返し、何も変えない", async () => {
    const owner = await createUser();
    const other = await createUser();
    const { id } = await createRecipe(owner.id, recipeInput(), "recipes/a.jpg");

    const outcome = await updateRecipe(other.id, id, recipeInput({ title: "書き換え" }), { type: "remove" });
    expect(outcome).toEqual({ result: "forbidden", unusedImageKey: null });
    const row = await db().recipe.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ title: "豚の生姜焼き", imageKey: "recipes/a.jpg" });
    expect(await db().ingredient.count({ where: { recipeId: id } })).toBe(2);
  });

  it("存在しないレシピは not_found", async () => {
    const user = await createUser();
    expect(await updateRecipe(user.id, 999, recipeInput())).toEqual({ result: "not_found", unusedImageKey: null });
  });

  it.each([
    ["keep", { type: "keep" } as const, "recipes/old.jpg", null],
    ["set", { type: "set", key: "recipes/new.jpg" } as const, "recipes/new.jpg", "recipes/old.jpg"],
    ["remove", { type: "remove" } as const, null, "recipes/old.jpg"],
  ])("写真 %s: 保存されるキーと、使われなくなったキーを返す", async (_name, change, savedKey, unusedKey) => {
    const owner = await createUser();
    const { id } = await createRecipe(owner.id, recipeInput(), "recipes/old.jpg");
    const outcome = await updateRecipe(owner.id, id, recipeInput(), change);
    expect(outcome).toEqual({ result: "ok", unusedImageKey: unusedKey });
    expect((await db().recipe.findUniqueOrThrow({ where: { id } })).imageKey).toBe(savedKey);
  });

  it("写真がないレシピを keep で更新しても、使われなくなったキーはない", async () => {
    const owner = await createUser();
    const { id } = await createRecipe(owner.id, recipeInput());
    expect(await updateRecipe(owner.id, id, recipeInput())).toEqual({ result: "ok", unusedImageKey: null });
  });
});

describe("deleteRecipe(F-04)", () => {
  it("本人なら削除し、材料・手順・お気に入りも消え、写真のキーを返す", async () => {
    const owner = await createUser();
    const fan = await createUser();
    const { id } = await createRecipe(owner.id, recipeInput(), "recipes/a.jpg");
    await db().favorite.create({ data: { userId: fan.id, recipeId: id } });

    expect(await deleteRecipe(owner.id, id)).toEqual({ result: "ok", unusedImageKey: "recipes/a.jpg" });
    expect(await db().recipe.count()).toBe(0);
    expect(await db().ingredient.count()).toBe(0);
    expect(await db().step.count()).toBe(0);
    expect(await db().favorite.count()).toBe(0);
  });

  it("他人のレシピは forbidden を返し、削除しない", async () => {
    const owner = await createUser();
    const other = await createUser();
    const { id } = await createRecipe(owner.id, recipeInput(), "recipes/a.jpg");

    expect(await deleteRecipe(other.id, id)).toEqual({ result: "forbidden", unusedImageKey: null });
    expect(await db().recipe.count()).toBe(1);
  });

  it("存在しないレシピ(二重に削除した場合を含む)は not_found", async () => {
    const owner = await createUser();
    const { id } = await createRecipe(owner.id, recipeInput());
    await deleteRecipe(owner.id, id);
    expect(await deleteRecipe(owner.id, id)).toEqual({ result: "not_found", unusedImageKey: null });
  });
});

describe("listRecipes(F-05 / F-07)", () => {
  /** 作成日時を1分ずつずらしてレシピを作る(index が大きいほど新しい) */
  async function seed(userId: number, inputs: Parameters<typeof recipeInput>[0][]) {
    const base = Date.UTC(2026, 10, 1);
    const ids: number[] = [];
    for (const [i, input] of inputs.entries()) {
      const { id } = await createRecipe(userId, recipeInput(input));
      await db().recipe.update({ where: { id }, data: { createdAt: new Date(base + i * 60_000) } });
      ids.push(id);
    }
    return ids;
  }

  it("新着順に PAGE_SIZE 件ずつ返し、カーソルで続きを取ると重複も抜けもない", async () => {
    const user = await createUser();
    const ids = await seed(
      user.id,
      Array.from({ length: PAGE_SIZE + 5 }, (_, i) => ({ title: `レシピ${i}` })),
    );

    const first = await listRecipes(parseRecipeSearch({}));
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first.items[0].id).toBe(ids.at(-1));
    expect(first.nextCursor).not.toBeNull();

    const second = await listRecipes(parseRecipeSearch({}), decodeCursor(first.nextCursor));
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();

    const all = [...first.items, ...second.items].map((r) => r.id);
    expect(all).toEqual([...ids].reverse());
  });

  it("同じ作成日時のレシピも ID の降順で、カーソルをまたいでも抜けない", async () => {
    const user = await createUser();
    const ids: number[] = [];
    const sameTime = new Date(Date.UTC(2026, 10, 1));
    for (let i = 0; i < PAGE_SIZE + 2; i++) {
      const { id } = await createRecipe(user.id, recipeInput());
      await db().recipe.update({ where: { id }, data: { createdAt: sameTime } });
      ids.push(id);
    }
    const first = await listRecipes(parseRecipeSearch({}));
    const second = await listRecipes(parseRecipeSearch({}), decodeCursor(first.nextCursor));
    expect([...first.items, ...second.items].map((r) => r.id)).toEqual([...ids].reverse());
  });

  it("キーワードは料理名か材料名に含まれるもの。大文字・小文字を区別せず、複数語は AND", async () => {
    const user = await createUser();
    const [egg, omu, salad] = await seed(user.id, [
      { title: "Egg Sandwich", ingredients: [{ name: "食パン", quantity: "" }] },
      { title: "オムライス", ingredients: [{ name: "卵", quantity: "2個" }, { name: "ごはん", quantity: "" }] },
      { title: "卵サラダ", ingredients: [{ name: "マヨネーズ", quantity: "" }] },
    ]);

    const ids = async (q: string) => (await listRecipes(parseRecipeSearch({ q }))).items.map((r) => r.id);
    expect(await ids("egg")).toEqual([egg]);
    expect(await ids("卵")).toEqual([salad, omu]);
    expect(await ids("卵 ごはん")).toEqual([omu]);
    expect(await ids("卵　マヨネーズ")).toEqual([salad]); // 全角スペース区切り
    expect(await ids("存在しない")).toEqual([]);
  });

  it("% と _ はワイルドカードではなく文字として検索する", async () => {
    const user = await createUser();
    const [jelly] = await seed(user.id, [{ title: "100%オレンジゼリー" }, { title: "1000円ランチ" }, { title: "a_b" }]);
    const ids = async (q: string) => (await listRecipes(parseRecipeSearch({ q }))).items.map((r) => r.id);
    expect(await ids("100%")).toEqual([jelly]);
    expect(await ids("_")).toHaveLength(1);
  });

  it("カテゴリと調理時間(以下)で絞り込む", async () => {
    const user = await createUser();
    const [quickMain, , quickSoup] = await seed(user.id, [
      { category: "MAIN", cookMinutes: 15 },
      { category: "MAIN", cookMinutes: 45 },
      { category: "SOUP", cookMinutes: 10 },
    ]);
    const ids = async (params: Record<string, string>) =>
      (await listRecipes(parseRecipeSearch(params))).items.map((r) => r.id);
    expect(await ids({ category: "MAIN", maxMinutes: "15" })).toEqual([quickMain]);
    expect(await ids({ maxMinutes: "15" })).toEqual([quickSoup, quickMain]);
  });

  it("カードには投稿者名・お気に入り数・見ている人が保存済みかが入る", async () => {
    const author = await createUser("author");
    const viewer = await createUser();
    const [id] = await seed(author.id, [{}]);
    await db().favorite.create({ data: { userId: viewer.id, recipeId: id } });

    const [asViewer] = (await listRecipes(parseRecipeSearch({}), null, viewer.id)).items;
    expect(asViewer).toMatchObject({ id, authorName: "author", favoriteCount: 1, favorited: true });
    const [asGuest] = (await listRecipes(parseRecipeSearch({}), null, null)).items;
    expect(asGuest).toMatchObject({ favoriteCount: 1, favorited: false });
  });
});

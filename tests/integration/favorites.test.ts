import { describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";
import { decodeCursor, PAGE_SIZE } from "@/lib/search/recipe-search";
import { isFavorited, listFavorites, setFavorite } from "@/lib/services/favorites";
import { createRecipe, deleteRecipe } from "@/lib/services/recipes";

import { createUser, recipeInput } from "../support/factories";

describe("setFavorite(F-08)", () => {
  it("保存・解除でき、お気に入り数を返す", async () => {
    const author = await createUser();
    const a = await createUser();
    const b = await createUser();
    const { id } = await createRecipe(author.id, recipeInput());

    expect(await setFavorite(a.id, id, true)).toEqual({ favorited: true, count: 1 });
    expect(await setFavorite(b.id, id, true)).toEqual({ favorited: true, count: 2 });
    expect(await isFavorited(a.id, id)).toBe(true);
    expect(await setFavorite(a.id, id, false)).toEqual({ favorited: false, count: 1 });
    expect(await isFavorited(a.id, id)).toBe(false);
  });

  it("同じ操作を二重に送っても結果は同じ(冪等)", async () => {
    const author = await createUser();
    const fan = await createUser();
    const { id } = await createRecipe(author.id, recipeInput());

    expect(await setFavorite(fan.id, id, true)).toEqual({ favorited: true, count: 1 });
    expect(await setFavorite(fan.id, id, true)).toEqual({ favorited: true, count: 1 });
    expect(await setFavorite(fan.id, id, false)).toEqual({ favorited: false, count: 0 });
    expect(await setFavorite(fan.id, id, false)).toEqual({ favorited: false, count: 0 });
  });

  it("同時に保存しても1件だけになる", async () => {
    const author = await createUser();
    const fan = await createUser();
    const { id } = await createRecipe(author.id, recipeInput());

    await Promise.all(Array.from({ length: 5 }, () => setFavorite(fan.id, id, true)));
    expect(await getDb().favorite.count()).toBe(1);
  });

  it("自分のレシピも保存できる", async () => {
    const author = await createUser();
    const { id } = await createRecipe(author.id, recipeInput());
    expect(await setFavorite(author.id, id, true)).toEqual({ favorited: true, count: 1 });
  });

  it("存在しない・削除されたレシピは not_found で、お気に入りを作らない", async () => {
    const author = await createUser();
    const fan = await createUser();
    const { id } = await createRecipe(author.id, recipeInput());
    await deleteRecipe(author.id, id);

    expect(await setFavorite(fan.id, id, true)).toBe("not_found");
    expect(await setFavorite(fan.id, 999, true)).toBe("not_found");
    expect(await getDb().favorite.count()).toBe(0);
  });
});

describe("listFavorites(F-08 / S-07)", () => {
  it("本人の分だけを、保存した日時の新しい順に返し、カーソルで続きを取れる", async () => {
    const author = await createUser();
    const me = await createUser();
    const other = await createUser();
    const ids: number[] = [];
    for (let i = 0; i < PAGE_SIZE + 3; i++) {
      ids.push((await createRecipe(author.id, recipeInput({ title: `レシピ${i}` }))).id);
    }
    // 保存した順番をレシピの作成順と逆にする(一覧は保存日時順であって投稿日時順ではないことを確かめる)
    const base = Date.UTC(2026, 10, 1);
    for (const [i, recipeId] of [...ids].reverse().entries()) {
      await getDb().favorite.create({ data: { userId: me.id, recipeId, createdAt: new Date(base + i * 60_000) } });
    }
    await getDb().favorite.create({ data: { userId: other.id, recipeId: ids[0] } });

    const first = await listFavorites(me.id);
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first.items.every((r) => r.favorited)).toBe(true);
    const second = await listFavorites(me.id, decodeCursor(first.nextCursor));
    expect(second.nextCursor).toBeNull();

    expect([...first.items, ...second.items].map((r) => r.id)).toEqual(ids);
  });

  it("保存していなければ空", async () => {
    const me = await createUser();
    expect(await listFavorites(me.id)).toEqual({ items: [], nextCursor: null });
  });
});

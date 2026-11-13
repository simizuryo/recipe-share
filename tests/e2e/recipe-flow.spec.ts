import { expect, type Page, test } from "@playwright/test";

/** 8x8 ピクセルの PNG(完成写真のアップロード用) */
const PNG_8X8 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4MzMNK2IYWhIA79xywXFxC2kAAAAASUVORK5CYII=",
  "base64",
);

const PASSWORD = "e2e-password-123";
const RECIPE_TITLE = "E2E 肉じゃが";

/** 実行のたびに違う名前にする(同じデータベースで何度流しても重複エラーにしない) */
function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36).slice(-6)}`;
}

/**
 * 「新規登録」のリンクから登録する。登録後はリンクが持つ戻り先へ移動する。
 * ログイン画面では、戻り先を引き継ぐフォーム下の「新規登録」を使う(ヘッダーのリンクはログイン画面に戻らないようトップに戻す)。
 */
async function signUpFrom(page: Page, name: string, via: "header" | "main" = "header") {
  const scope = via === "header" ? page.getByRole("banner") : page.getByRole("main");
  await scope.getByRole("link", { name: "新規登録" }).click();
  await expect(page).toHaveURL(/\/signup/);
  await page.getByLabel("ユーザー名").fill(name);
  await page.getByLabel("表示名").fill(name);
  await page.getByLabel("メールアドレス").fill(`${name}@example.test`);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "登録する" }).click();
  // ヘッダーに表示名のメニューが出たらログイン済み
  await expect(page.locator("header summary", { hasText: name })).toBeVisible();
}

async function signOut(page: Page, name: string) {
  await page.locator("header summary", { hasText: name }).click();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByRole("navigation", { name: "アカウント" }).getByRole("link", { name: "ログイン" })).toBeVisible();
}

test("投稿 → 検索 → お気に入り の一連の流れ", async ({ page }) => {
  const author = uniqueName("author");
  const fan = uniqueName("fan");
  let recipeUrl = "";

  await test.step("投稿者が登録してレシピを写真付きで投稿する", async () => {
    await page.goto("/");
    await signUpFrom(page, author);

    await page.goto("/recipes/new");
    await page.getByLabel("料理名").fill(RECIPE_TITLE);
    await page.getByLabel("分量(人分)").fill("2");
    await page.getByLabel("調理時間(分)").fill("30");
    await page.getByLabel("カテゴリ").selectOption({ label: "主菜" });
    await page.getByLabel("材料 1 の名前").fill("じゃがいも");
    await page.getByLabel("材料 1 の分量").fill("3個");
    await page.getByRole("button", { name: "+ 材料を追加" }).click();
    await page.getByLabel("材料 2 の名前").fill("牛こま切れ肉");
    await page.getByLabel("材料 2 の分量").fill("200g");
    await page.getByLabel("手順 1", { exact: true }).fill("材料を切る");
    await page.getByRole("button", { name: "+ 手順を追加" }).click();
    await page.getByLabel("手順 2", { exact: true }).fill("煮る");
    await page.getByLabel("完成写真").setInputFiles({ name: "nikujaga.png", mimeType: "image/png", buffer: PNG_8X8 });
    await page.getByRole("button", { name: "投稿する" }).click();

    await expect(page).toHaveURL(/\/recipes\/\d+$/);
    recipeUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { level: 1, name: RECIPE_TITLE })).toBeVisible();
    await expect(page.getByRole("link", { name: "編集" })).toBeVisible();
    // 写真がストレージから読み出せて表示されている
    const photo = page.getByRole("img", { name: `${RECIPE_TITLE}の完成写真` });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    await signOut(page, author);
  });

  await test.step("ゲストがお気に入りを押すとログイン画面へ移動する", async () => {
    await page.goto(recipeUrl);
    await page.getByRole("link", { name: /ログインしてお気に入りに保存/ }).click();
    await expect(page).toHaveURL(/\/login\?/);
  });

  await test.step("別のユーザーが登録すると、元のレシピに戻る", async () => {
    await signUpFrom(page, fan, "main");
    await expect(page).toHaveURL(new RegExp(`${recipeUrl}$`));
    // 投稿者でなければ編集・削除は出ない
    await expect(page.getByRole("heading", { level: 1, name: RECIPE_TITLE })).toBeVisible();
    await expect(page.getByRole("link", { name: "編集" })).toHaveCount(0);
  });

  await test.step("材料名で検索して見つける", async () => {
    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "レシピを検索" });
    await search.fill("牛こま");
    await search.press("Enter");
    await expect(page).toHaveURL(/[?&]q=/);
    const list = page.getByRole("list", { name: "レシピ一覧" });
    await expect(list.getByRole("link", { name: RECIPE_TITLE })).toBeVisible();

    await search.fill("存在しない料理");
    await search.press("Enter");
    await expect(page.getByText("条件に合うレシピがありません")).toBeVisible();
  });

  await test.step("詳細画面でお気に入りに保存し、お気に入り一覧に出る", async () => {
    await page.goto(recipeUrl);
    const button = page.getByRole("button", { name: /^お気に入り/ });
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toHaveAccessibleName("お気に入り(1件)");

    await page.goto("/me/favorites");
    const favorites = page.getByRole("list", { name: "お気に入りのレシピ" });
    await expect(favorites.getByRole("link", { name: RECIPE_TITLE })).toBeVisible();
  });

  await test.step("お気に入りを解除すると、一覧から消える", async () => {
    await page
      .getByRole("list", { name: "お気に入りのレシピ" })
      .getByRole("button", { name: /^お気に入り/ })
      .click();
    await expect(page.getByRole("button", { name: "お気に入り(0件)" })).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(page.getByText("まだお気に入りがありません")).toBeVisible();
  });

  await test.step("他人のレシピの編集画面を直接開いても編集できない", async () => {
    await page.goto(`${recipeUrl}/edit`);
    await expect(page.getByText("このレシピを編集する権限がありません")).toBeVisible();
    await expect(page.getByRole("button", { name: "更新する" })).toHaveCount(0);
  });
});

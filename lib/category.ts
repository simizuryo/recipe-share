import { Category } from "@/lib/generated/prisma/enums";

/** カテゴリの表示名(docs/requirements/00-overview.md の用語定義) */
export const CATEGORY_LABELS: Record<Category, string> = {
  [Category.MAIN]: "主菜",
  [Category.SIDE]: "副菜",
  [Category.SOUP]: "汁物",
  [Category.STAPLE]: "主食",
  [Category.DESSERT]: "デザート",
  [Category.OTHER]: "その他",
};

/** 画面に並べる順番 */
export const CATEGORIES: readonly Category[] = Object.values(Category);

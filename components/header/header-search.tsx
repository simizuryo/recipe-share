"use client";

import Form from "next/form";
import { usePathname, useSearchParams } from "next/navigation";

import { MAX_QUERY_LENGTH } from "@/lib/search/recipe-search";

import styles from "./header.module.css";

/**
 * ヘッダーの検索欄(F-07)。トップで検索中は、今のキーワードを入れておき、
 * カテゴリ・調理時間の絞り込みも引き継ぐ。ほかの画面からはキーワードだけで検索する。
 */
export function HeaderSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onTop = pathname === "/";
  const q = onTop ? (searchParams.get("q") ?? "") : "";
  const kept = onTop ? (["category", "maxMinutes"] as const).filter((name) => searchParams.get(name)) : [];

  return (
    // key: 検索条件が変わったら入力欄を作り直して、今のキーワードを表示する
    <Form key={q} action="/" className={styles.search} role="search">
      <SearchInput defaultValue={q} />
      {kept.map((name) => (
        <input key={name} type="hidden" name={name} value={searchParams.get(name) ?? ""} />
      ))}
    </Form>
  );
}

/** 読み込み中(useSearchParams が使えるまで)に出す検索欄 */
export function HeaderSearchFallback() {
  return (
    <Form action="/" className={styles.search} role="search">
      <SearchInput />
    </Form>
  );
}

function SearchInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <input
      type="search"
      name="q"
      defaultValue={defaultValue}
      placeholder="料理名・材料で検索"
      aria-label="レシピを検索"
      className={styles.searchInput}
      maxLength={MAX_QUERY_LENGTH}
    />
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { setFavoriteAction } from "@/app/actions/favorites";
import { loginUrl } from "@/lib/auth-redirect";

import styles from "./favorite-button.module.css";

type Props = {
  recipeId: number;
  favorited: boolean;
  count: number;
  /** ログイン中か。ゲストにはログイン画面へのリンクを出す */
  signedIn: boolean;
  /** ゲストがログインした後に戻る画面 */
  returnTo: string;
  /** 一覧のカードでは小さく表示する */
  size?: "small" | "normal";
};

/**
 * お気に入りボタン(F-08)。押した時点で表示を変え(楽観的更新)、サーバーの結果で上書きする。
 * 失敗したら元に戻してメッセージを出す。
 */
export function FavoriteButton({ recipeId, favorited, count, signedIn, returnTo, size = "normal" }: Props) {
  const [state, setState] = useState({ favorited, count });
  const [error, setError] = useState<string | null>(null);
  // サーバーから新しい値が届いたら(ログイン直後の再取得など)表示をそれに合わせる。
  // Next.js は前に開いた画面の状態を保持するので、初期値だけ見ているとゲストのときの表示が残る
  const [fromServer, setFromServer] = useState({ favorited, count });
  if (fromServer.favorited !== favorited || fromServer.count !== count) {
    setFromServer({ favorited, count });
    setState({ favorited, count });
  }
  const [pending, startTransition] = useTransition();
  const className = `${styles.button} ${size === "small" ? styles.small : ""}`;

  if (!signedIn) {
    return (
      <Link href={loginUrl(returnTo)} className={className} aria-label={`ログインしてお気に入りに保存(${count}件)`}>
        <span aria-hidden>♡</span> {count}
      </Link>
    );
  }

  function toggle() {
    const prev = state;
    const next = !prev.favorited;
    setError(null);
    setState({ favorited: next, count: Math.max(0, prev.count + (next ? 1 : -1)) });
    startTransition(async () => {
      try {
        const result = await setFavoriteAction(recipeId, next, returnTo);
        if (result.ok) {
          setState({ favorited: result.favorited, count: result.count });
        } else {
          setState(prev);
          setError(result.error);
        }
      } catch {
        setState(prev);
        setError("保存できませんでした。時間をおいてやり直してください");
      }
    });
  }

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={className}
        aria-pressed={state.favorited}
        aria-label={`お気に入り(${state.count}件)`}
        onClick={toggle}
        disabled={pending}
        data-favorited={state.favorited || undefined}
      >
        <span aria-hidden>{state.favorited ? "♥" : "♡"}</span> {state.count}
      </button>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

"use client";

import { useActionState, useRef } from "react";

import type { DeleteRecipeState } from "@/app/recipes/[id]/actions";

import styles from "./recipe-owner-actions.module.css";

/**
 * レシピの削除ボタン(F-04)。押すと確認ダイアログを開き、「削除する」を押したときだけ削除する。
 * ダイアログはブラウザ標準の confirm() ではなく <dialog> を使う(見た目をそろえ、操作を止めないため)。
 */
export function DeleteRecipeButton({
  title,
  action,
}: {
  title: string;
  action: (prev: DeleteRecipeState) => Promise<DeleteRecipeState>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <>
      <button type="button" className={styles.danger} onClick={() => dialogRef.current?.showModal()}>
        削除
      </button>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="delete-recipe-heading">
        <h2 id="delete-recipe-heading" className={styles.dialogTitle}>
          レシピを削除しますか?
        </h2>
        <p className={styles.dialogBody}>
          「{title}」を削除します。お気に入り・コメントも一緒に消え、元に戻せません。
        </p>
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        <div className={styles.dialogButtons}>
          <button type="button" className={styles.secondary} onClick={() => dialogRef.current?.close()} disabled={pending}>
            キャンセル
          </button>
          <form action={formAction}>
            <button type="submit" className={styles.danger} disabled={pending}>
              {pending ? "削除しています…" : "削除する"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

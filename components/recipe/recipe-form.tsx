"use client";

import { useActionState, useState } from "react";

import type { RecipeFormState } from "@/app/recipes/new/actions";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/category";
import { MAX_INGREDIENTS, MAX_STEPS, type RecipeFormValues } from "@/lib/validation/recipe";

import styles from "./recipe-form.module.css";

type Row<T> = T & { key: number };

// 行の key(並び替え・削除しても入力欄の対応がずれないように、行ごとに一意の番号を付ける)
let keySeq = 0;
const withKeys = <T,>(rows: T[]): Row<T>[] => rows.map((row) => ({ ...row, key: keySeq++ }));

const EMPTY_VALUES: RecipeFormValues = {
  title: "",
  description: "",
  servings: "2",
  cookMinutes: "",
  category: "",
  ingredients: [],
  steps: [],
};

/**
 * レシピの入力フォーム(S-05)。投稿(F-03)と編集(F-04)で使う。
 * 材料・手順の欄は画面の並び順のまま送信され、その順番で保存される。
 * 入力欄は state で持つので、エラーで戻ってきても入力内容は消えない。
 */
export function RecipeForm({
  action,
  initialValues = EMPTY_VALUES,
  submitLabel,
}: {
  action: (prev: RecipeFormState, formData: FormData) => Promise<RecipeFormState>;
  initialValues?: RecipeFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  const [fields, setFields] = useState(() => pickFields(initialValues));
  const [ingredients, setIngredients] = useState(() =>
    withKeys(initialValues.ingredients.length > 0 ? initialValues.ingredients : [{ name: "", quantity: "" }]),
  );
  const [steps, setSteps] = useState(() =>
    withKeys(initialValues.steps.length > 0 ? initialValues.steps : [{ body: "" }]),
  );

  // サーバーから入力エラーが返ってきたら、空行を除いた値(エラーの行番号と一致する)に置き換える
  const [shownState, setShownState] = useState(state);
  if (state !== shownState) {
    setShownState(state);
    if (state.values) {
      setFields(pickFields(state.values));
      setIngredients(withKeys(state.values.ingredients.length > 0 ? state.values.ingredients : [{ name: "", quantity: "" }]));
      setSteps(withKeys(state.values.steps.length > 0 ? state.values.steps : [{ body: "" }]));
    }
  }

  const errors = state.errors ?? {};
  const setField = (name: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [name]: e.target.value }));

  return (
    <form action={formAction} className={styles.form} noValidate>
      {errors.form && (
        <p className={styles.formError} role="alert">
          {errors.form}
        </p>
      )}
      {Object.keys(errors).length > 0 && !errors.form && (
        <p className={styles.formError} role="alert">
          入力内容を確認してください
        </p>
      )}

      <Field id="title" label="料理名" required error={errors.title}>
        <input
          id="title"
          name="title"
          className={styles.input}
          value={fields.title}
          onChange={setField("title")}
          maxLength={50}
          aria-invalid={!!errors.title}
        />
      </Field>

      <Field id="description" label="説明(ひとこと)" error={errors.description}>
        <textarea
          id="description"
          name="description"
          className={styles.textarea}
          rows={3}
          value={fields.description}
          onChange={setField("description")}
          maxLength={300}
          aria-invalid={!!errors.description}
        />
      </Field>

      <div className={styles.row3}>
        <Field id="servings" label="分量(人分)" required error={errors.servings}>
          <input
            id="servings"
            name="servings"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            className={styles.input}
            value={fields.servings}
            onChange={setField("servings")}
            aria-invalid={!!errors.servings}
          />
        </Field>
        <Field id="cookMinutes" label="調理時間(分)" required error={errors.cookMinutes}>
          <input
            id="cookMinutes"
            name="cookMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            className={styles.input}
            value={fields.cookMinutes}
            onChange={setField("cookMinutes")}
            aria-invalid={!!errors.cookMinutes}
          />
        </Field>
        <Field id="category" label="カテゴリ" required error={errors.category}>
          <select
            id="category"
            name="category"
            className={styles.input}
            value={fields.category}
            onChange={setField("category")}
            aria-invalid={!!errors.category}
          >
            <option value="">選んでください</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>
          材料 <span className={styles.required}>必須</span>
        </legend>
        {errors.ingredients && <p className={styles.error}>{errors.ingredients}</p>}
        <ol className={styles.rows}>
          {ingredients.map((row, i) => {
            const nameError = errors[`ingredients.${i}.name`];
            const quantityError = errors[`ingredients.${i}.quantity`];
            return (
              <li key={row.key} className={styles.rowItem}>
                <div className={styles.rowInputs}>
                  <input
                    name="ingredientName"
                    aria-label={`材料 ${i + 1} の名前`}
                    placeholder="材料名(例: 玉ねぎ)"
                    className={`${styles.input} ${styles.grow}`}
                    value={row.name}
                    maxLength={30}
                    onChange={(e) => setIngredients(updateRow(ingredients, i, { name: e.target.value }))}
                    aria-invalid={!!nameError}
                  />
                  <input
                    name="ingredientQuantity"
                    aria-label={`材料 ${i + 1} の分量`}
                    placeholder="分量(例: 1/2個)"
                    className={`${styles.input} ${styles.quantity}`}
                    value={row.quantity}
                    maxLength={20}
                    onChange={(e) => setIngredients(updateRow(ingredients, i, { quantity: e.target.value }))}
                    aria-invalid={!!quantityError}
                  />
                  <RowButtons
                    label={`材料 ${i + 1}`}
                    index={i}
                    count={ingredients.length}
                    onMove={(to) => setIngredients(moveRow(ingredients, i, to))}
                    onRemove={() => setIngredients(ingredients.filter((_, j) => j !== i))}
                  />
                </div>
                {(nameError || quantityError) && <p className={styles.error}>{nameError ?? quantityError}</p>}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className={styles.addButton}
          disabled={ingredients.length >= MAX_INGREDIENTS}
          onClick={() => setIngredients([...ingredients, ...withKeys([{ name: "", quantity: "" }])])}
        >
          + 材料を追加
        </button>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>
          作り方 <span className={styles.required}>必須</span>
        </legend>
        {errors.steps && <p className={styles.error}>{errors.steps}</p>}
        <ol className={styles.rows}>
          {steps.map((row, i) => {
            const bodyError = errors[`steps.${i}.body`];
            return (
              <li key={row.key} className={styles.rowItem}>
                <div className={styles.rowInputs}>
                  <span className={styles.stepNumber} aria-hidden>
                    {i + 1}
                  </span>
                  <textarea
                    name="stepBody"
                    aria-label={`手順 ${i + 1}`}
                    className={`${styles.textarea} ${styles.grow}`}
                    rows={2}
                    value={row.body}
                    maxLength={300}
                    onChange={(e) => setSteps(updateRow(steps, i, { body: e.target.value }))}
                    aria-invalid={!!bodyError}
                  />
                  <RowButtons
                    label={`手順 ${i + 1}`}
                    index={i}
                    count={steps.length}
                    onMove={(to) => setSteps(moveRow(steps, i, to))}
                    onRemove={() => setSteps(steps.filter((_, j) => j !== i))}
                  />
                </div>
                {bodyError && <p className={styles.error}>{bodyError}</p>}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className={styles.addButton}
          disabled={steps.length >= MAX_STEPS}
          onClick={() => setSteps([...steps, ...withKeys([{ body: "" }])])}
        >
          + 手順を追加
        </button>
      </fieldset>

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "保存しています…" : submitLabel}
      </button>
    </form>
  );
}

function pickFields(v: RecipeFormValues) {
  return {
    title: v.title,
    description: v.description,
    servings: v.servings,
    cookMinutes: v.cookMinutes,
    category: v.category,
  };
}

function updateRow<T>(rows: T[], index: number, patch: Partial<T>): T[] {
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

function moveRow<T>(rows: T[], from: number, to: number): T[] {
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function RowButtons({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.rowButtons}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`${label} を上へ`}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`${label} を下へ`}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`${label} を削除`}
        disabled={count === 1}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label} {required && <span className={styles.required}>必須</span>}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

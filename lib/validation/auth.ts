import { z } from "zod";

/**
 * ユーザー登録の入力(F-01)
 * - ユーザー名: 半角英数字と _、3〜20文字
 * - 表示名: 1〜20文字(前後の空白は除く)
 * - メールアドレス: 小文字にそろえる(Better Auth も小文字で保存する)
 * - パスワード: 8〜72文字(前後の空白も含めてそのまま使う)
 */
export const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]{3,20}$/, "ユーザー名は半角英数字と _ で 3〜20 文字にしてください"),
  name: z
    .string()
    .trim()
    .min(1, "表示名を入力してください")
    .max(20, "表示名は 20 文字以内にしてください"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "メールアドレスを入力してください")
    .max(255, "メールアドレスは 255 文字以内にしてください")
    .pipe(z.email("メールアドレスの形式が正しくありません")),
  password: z
    .string()
    .min(8, "パスワードは 8 文字以上にしてください")
    .max(72, "パスワードは 72 文字以内にしてください"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignUpField = keyof SignUpInput;

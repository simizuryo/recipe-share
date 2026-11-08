import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/lib/db";

/**
 * 認証の設定(docs/requirements/02-non-functional-requirements.md 6.1)
 * - メールアドレス + パスワード。パスワードは 8〜72 文字
 * - セッションは DB(sessions テーブル)に保存し、Cookie で受け渡す
 * - ID は DB の連番(users.id は integer)
 * - レート制限の記録は DB に置く(Vercel では複数のインスタンスで動くため)
 * 秘密鍵と URL は環境変数 BETTER_AUTH_SECRET / BETTER_AUTH_URL から読まれる。
 */
export const auth = betterAuth({
  database: prismaAdapter(getDb(), { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 72,
    // 登録したらそのままログイン状態にする(F-01)
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      username: { type: "string", required: true, input: true },
      bio: { type: "string", required: false, input: false },
    },
  },
  advanced: {
    database: { generateId: "serial" },
  },
  rateLimit: {
    storage: "database",
    customRules: {
      // ログインは同じ接続元から 1分 10回まで(総当たり対策)
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  // Server Actions からログイン・ログアウトしたときも Cookie を書き込めるようにする(最後に置く)
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

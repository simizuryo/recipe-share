# recipe-share

料理のレシピを投稿・検索・保存できるレシピ共有アプリ(スクール課題)。

- 要件定義書: [docs/requirements.md](docs/requirements.md)
- 技術: Next.js 16(App Router、TypeScript)/ Prisma 7 + PostgreSQL 16 / Better Auth / 写真は S3 互換ストレージ(詳しくは [技術スタック](docs/requirements/05-tech-stack.md))

## セットアップ

必要なもの: Node.js 24、Docker Desktop

```sh
# 1. DB(PostgreSQL、ポート 5434)と写真の保存先(RustFS、ポート 9200)を起動する
docker compose up -d

# 2. 環境変数のファイルを作り、BETTER_AUTH_SECRET をランダムな文字列に書き換える
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. パッケージを入れる(Prisma Client も生成される)
npm ci

# 4. テーブルを作る
npm run db:migrate

# 5. 写真の保存先のバケットを作る(初回だけ)
npm run storage:init

# 6. 開発サーバーを起動する → http://localhost:3000
npm run dev
```

動作確認: http://localhost:3000/api/health が `{"status":"ok","database":"ok"}` を返せば、DB に接続できています。

開発サーバーでページの再読み込みが止まらなくなったとき(ターミナルに「✓ Compiled in 1ms」と GET が繰り返し出る): 開発サーバーを止めて `.next/dev` フォルダを消し、もう一度 `npm run dev` で起動する。`.next/dev` は開発サーバーが作り直すキャッシュなので、消しても問題ない。

## npm scripts

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm run typecheck` | 型チェック(`next typegen` で Next.js のルートの型を作ってから `tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm test` | 単体テスト(Vitest、`tests/unit/`。DB 不要) |
| `npm run test:integration` | 統合テスト(Vitest、`tests/integration/`。service 層を本物の PostgreSQL で確かめる) |
| `npm run test:e2e` | E2E テスト(Playwright、`tests/e2e/`。ブラウザで投稿 → 検索 → お気に入りの流れを確かめる) |
| `npm run db:migrate` | スキーマの変更からマイグレーションを作って適用する(開発用) |
| `npm run db:deploy` | 作成済みのマイグレーションを適用する(本番用) |
| `npm run db:studio` | DB の中身をブラウザで見る(Prisma Studio) |
| `npm run storage:init` | 写真の保存先のバケットを作る(ローカルの RustFS。すでにあれば何もしない) |

Pull Request では GitHub Actions が typecheck・lint・単体テスト・build と、統合テスト(PostgreSQL のサービスコンテナを使う)を実行する。E2E テストは手元で実行する。

## テスト

| 種類 | 場所 | 対象 | 使うもの |
|---|---|---|---|
| 単体 | `tests/unit/` | 入力検証、検索条件の組み立て、写真の形式判定、戻り先の判定、ログの伏せ字 | なし |
| 統合 | `tests/integration/` | `lib/services/` のレシピ投稿・編集・削除(本人以外は forbidden、存在しなければ not_found、写真のキー)、お気に入り(冪等・同時操作・削除済み)、一覧・検索・「もっと見る」の続き、登録時の重複確認 | PostgreSQL |
| E2E | `tests/e2e/` | 登録 → 写真付きで投稿 → ゲストのお気に入りはログインへ → 別ユーザーで登録 → 検索 → お気に入りの保存・一覧・解除 → 他人のレシピは編集できない | PostgreSQL・RustFS・ブラウザ |

```sh
docker compose up -d          # 統合・E2E の前に DB と写真の保存先を起動する
npm test                      # 単体
npm run test:integration      # 統合
npx playwright install chromium   # E2E の初回だけ(ブラウザを入れる)
npm run test:e2e              # E2E(本番ビルドを作ってポート 3100 で起動してから実行する。数分かかる)
```

- 統合テストは `recipe_share_test`、E2E は `recipe_share_e2e_test` データベースを使う(なければ自動で作り、マイグレーションを当てる)。テストのたびに中身を消すが、開発用の `recipe_share` には触らない。データベース名が `_test` で終わらない接続先では動かないようにしてある。接続先は `TEST_DATABASE_URL` / `E2E_DATABASE_URL` で変えられる。
- E2E の写真は `recipe-share-e2e` バケットに保存する(自動で作る)。失敗したときは `playwright-report/` と `test-results/`(スクリーンショット・トレース)を見る。

## ログ

サーバーのログは `lib/logger.ts` で、1件を JSON 1行で書き出す(Vercel のログ画面で検索しやすくするため)。

```json
{"time":"2026-11-13T13:05:03.046Z","level":"error","msg":"レシピの保存に失敗しました","userId":3,"error":{"name":"Error","message":"…","stack":"…"}}
```

- `logger.error("メッセージ", { userId, recipeId, error })` のように、メッセージと項目を分けて渡す。Error は name・message・stack・cause に展開される。
- **パスワード・トークン・Cookie・秘密鍵などはキー名で判断して `[REDACTED]` に置き換える**(`password`・`token`・`secret`・`cookie`・`authorization`・`apiKey` などを含むキー)。秘密の値は分かる名前のキーで渡すこと。
- 捕まえられなかったエラー(画面の描画・Route Handler・Server Actions)は `instrumentation.ts` の `onRequestError` で記録する。リクエストのヘッダー(Cookie)とクエリ文字列は書き出さない。
- Better Auth 自身のログ(warn 以上)も同じ形式で書き出す。
- 出力するレベルは環境変数 `LOG_LEVEL`(`debug` / `info` / `warn` / `error` / `silent`、既定は `info`)。error・warn は標準エラー、それ以外は標準出力に出る。

## デプロイ(Vercel + Supabase)

本番は Vercel(アプリ)+ Supabase(PostgreSQL と写真の保存先)。どちらも東京リージョンに置く(`vercel.json` で関数を `hnd1` に固定)。

### 1. Supabase

1. プロジェクトを作る(Region: Northeast Asia (Tokyo))。DB のパスワードは生成したものを控える。
2. Storage で**非公開**のバケット `recipe-share-images` を作る(Public bucket はオフ。写真はアプリの `/api/images/` から配信する)。
3. Storage の S3 の設定画面で Endpoint・Region を控え、S3 Access Keys で鍵を作る(Secret は作成時にしか表示されない)。
4. Connect → Connection String で接続文字列を控える。
   - **Transaction pooler(ポート 6543)**: アプリ(Vercel)の `DATABASE_URL` に使う
   - **Session pooler(ポート 5432)**: ローカルからのマイグレーションに使う
   - Direct connection は IPv6 専用なので使わない
   - **`?sslmode=...` は付けない。** 付けると pg が下記の TLS 設定を上書きする

DB との通信は Supabase の認証局(Supabase Root 2021 CA)で証明書を検証して暗号化する。この認証局は Node.js に入っていないため、証明書を `lib/db-ssl.ts` に持たせ、接続先が `*.supabase.com` / `*.supabase.co` のときだけ使う(ローカルの DB では TLS を使わない)。証明書の有効期限は 2031-04-26。

### 2. 本番 DB のマイグレーション(ローカルから)

```sh
DATABASE_URL="<Session pooler の接続文字列>" npx prisma migrate deploy
```

### 3. Vercel

GitHub のリポジトリを読み込み(Framework: Next.js、設定は既定のまま)、環境変数を Production に設定してデプロイする。

| 変数 | 値 |
|---|---|
| `DATABASE_URL` | Transaction pooler(ポート 6543)の接続文字列 |
| `BETTER_AUTH_SECRET` | 32 文字以上のランダムな文字列(ローカルとは別の値) |
| `BETTER_AUTH_URL` | 本番の URL(例: `https://recipe-share-xxx.vercel.app`) |
| `S3_ENDPOINT` | `https://<プロジェクトID>.storage.supabase.co/storage/v1/s3` |
| `S3_REGION` | `ap-northeast-1` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Supabase の S3 Access Keys |
| `S3_BUCKET` | `recipe-share-images` |

- 環境変数を変えたら再デプロイする(すでに動いているデプロイには反映されない)。
- 写真の上限 4MB は Vercel の関数のリクエスト本体の上限(4.5MB)に合わせている。
- 新しいマイグレーションを追加したら、デプロイの前に手順 2 を実行する。

## ディレクトリ構成

| 場所 | 内容 |
|---|---|
| `app/` | 画面と Server Actions、Route Handler(`app/api/auth` は Better Auth、`app/api/health` は動作確認用) |
| `lib/` | 共通の処理(`db.ts` は Prisma Client、`db-ssl.ts` は本番 DB の TLS 設定、`auth.ts` は認証の設定、`storage.ts` は写真の保存先)。業務ルールは `lib/services/` に置く |
| `lib/generated/` | Prisma が生成するコード(コミットしない) |
| `scripts/` | 開発用のスクリプト(`create-bucket.mjs` は写真の保存先のバケットを作る) |
| `prisma/` | スキーマとマイグレーション |
| `tests/` | テスト(`unit/` 単体、`integration/` 統合、`e2e/` E2E、`support/` テスト用の共通処理) |
| `instrumentation.ts` | 想定外のエラーをログに残す(Next.js の `onRequestError`) |
| `docs/` | 要件定義書 |

## 開発ルール

作業手順は [CLAUDE.md](CLAUDE.md) を参照(Issue → 作業ブランチ → Pull Request)。
クローンしたら、main への直接 push を防ぐフックを有効にする。

```sh
git config core.hooksPath .githooks
```

### メモ

- npm 11 はパッケージのインストールスクリプトを許可したものしか実行しない。Prisma(`prisma`、`@prisma/engines`)は `package.json` の `allowScripts` で許可している。
- `AGENTS.md` は Next.js が自動で書くファイル(AI エージェント向けに、同梱ドキュメント `node_modules/next/dist/docs/` を読むよう促す内容)。

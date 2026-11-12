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

# 5. 開発サーバーを起動する → http://localhost:3000
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
| `npm test` | 単体テスト(Vitest、`tests/unit/`) |
| `npm run db:migrate` | スキーマの変更からマイグレーションを作って適用する(開発用) |
| `npm run db:deploy` | 作成済みのマイグレーションを適用する(本番用) |
| `npm run db:studio` | DB の中身をブラウザで見る(Prisma Studio) |

Pull Request では GitHub Actions が typecheck・lint・test・build を実行する。

## ディレクトリ構成

| 場所 | 内容 |
|---|---|
| `app/` | 画面と Server Actions、Route Handler(`app/api/auth` は Better Auth、`app/api/health` は動作確認用) |
| `lib/` | 共通の処理(`db.ts` は Prisma Client、`auth.ts` は認証の設定)。業務ルールは `lib/services/` に置く |
| `lib/generated/` | Prisma が生成するコード(コミットしない) |
| `prisma/` | スキーマとマイグレーション |
| `tests/unit/` | 単体テスト |
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

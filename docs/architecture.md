# 構成図・ER 図

システムの全体像とデータ構造を図でまとめる。詳しい方針は [技術スタック](requirements/05-tech-stack.md)、テーブルの定義は [データモデル](requirements/03-data-model.md) と `prisma/schema.prisma`(こちらが正)を参照。

## 1. システム構成(本番)

アプリは Vercel、DB と写真の保存先は Supabase。どちらも東京リージョンに置く。

```mermaid
flowchart LR
    B["ブラウザ"]

    subgraph V["Vercel(関数: hnd1 / 東京)"]
        N["Next.js 16<br/>App Router"]
    end

    subgraph S["Supabase(Northeast Asia / Tokyo)"]
        P[("PostgreSQL<br/>Transaction pooler :6543")]
        O[("Storage<br/>非公開バケット<br/>recipe-share-images")]
    end

    G["GitHub<br/>main ブランチ"]

    B -- "画面表示 / Server Actions<br/>セッション Cookie" --> N
    B -- "写真 GET /api/images/..." --> N
    N -- "Prisma(TLS: Supabase Root 2021 CA)" --> P
    N -- "S3 API" --> O
    G -- "push で自動デプロイ" --> V
```

- 写真のバケットは非公開のまま。ブラウザは `/api/images/<キー>` にアクセスし、アプリがストレージから読み出して返す(`next/image` で縮小、長期キャッシュ)。
- 本番 DB のマイグレーションは、デプロイの前にローカルから Session pooler(ポート 5432)に対して `prisma migrate deploy` で行う。

## 2. ローカル開発環境

```mermaid
flowchart LR
    B["ブラウザ<br/>localhost:3000"] --> N["Next.js 開発サーバー<br/>npm run dev"]

    subgraph D["Docker Compose"]
        P[("PostgreSQL 16<br/>:5434")]
        O[("RustFS(S3 互換)<br/>:9200")]
    end

    N -- Prisma --> P
    N -- "S3 API" --> O
```

テストは同じコンテナを使い、データベース・バケットを分ける(統合: `recipe_share_test`、E2E: `recipe_share_e2e_test` / `recipe-share-e2e`)。

## 3. アプリケーションの層

画面・Server Actions・Route Handler から直接 Prisma を呼ばず、必ず `lib/services/` を通す(権限確認と業務ルールをここに集める)。例外は動作確認用の `/api/health` だけ。写真の保存・読み出しは DB と関係しないため、Server Actions と画像の Route Handler が `lib/storage.ts` を直接使う。

```mermaid
flowchart TD
    subgraph UI["app/・components/(画面・入口)"]
        SC["Server Components<br/>一覧・詳細・お気に入り一覧"]
        CC["Client Components<br/>フォーム・お気に入りボタン・もっと見る"]
        SA["Server Actions<br/>投稿・編集・削除・お気に入り・登録"]
        RH["Route Handler app/api/<br/>recipes・me/favorites(もっと見る)<br/>images(写真)・auth・health"]
    end

    SE["lib/session.ts<br/>ログイン中のユーザー"]
    V["lib/validation/<br/>Zod による入力検証"]
    SV["lib/services/<br/>recipes / favorites / users"]
    AU["lib/auth.ts<br/>Better Auth"]
    DB["lib/db.ts<br/>Prisma Client"]
    ST["lib/storage.ts<br/>S3 クライアント"]

    CC --> SA
    CC --> RH
    SC --> SE
    SA --> SE
    RH --> SE
    SE --> AU
    SA -- "登録・ログアウト" --> AU
    SA --> V
    SC --> SV
    SA --> SV
    RH --> SV
    SA --> ST
    RH --> ST
    SV --> DB
    AU --> DB
```

ログは `lib/logger.ts`(JSON 1 行)で、Server Actions・Route Handler・`instrumentation.ts` から書き出す。

## 4. ER 図

認証用のテーブル(Better Auth が読み書きする)とレシピのテーブル。`comments` は v1.1(F-11)用に先に作ってあり、v1 の画面からは使っていない。

```mermaid
erDiagram
    users ||--o{ sessions : "ログイン中"
    users ||--o{ accounts : "ログイン方法"
    users ||--o{ recipes : "投稿する"
    users ||--o{ favorites : "保存する"
    users ||--o{ comments : "書く"
    recipes ||--|{ ingredients : "材料を持つ"
    recipes ||--|{ steps : "手順を持つ"
    recipes ||--o{ favorites : "保存される"
    recipes ||--o{ comments : "付けられる"

    users {
        int id PK
        varchar username UK "URL 用 3〜20 文字"
        varchar display_name "表示名"
        varchar email UK
        boolean email_verified
        text image
        varchar bio "自己紹介"
        timestamptz created_at
        timestamptz updated_at
    }
    sessions {
        int id PK
        int user_id FK
        text token UK
        timestamptz expires_at
        text ip_address
        text user_agent
    }
    accounts {
        int id PK
        int user_id FK
        text account_id
        text provider_id
        text password "ハッシュ"
    }
    verifications {
        int id PK
        text identifier
        text value
        timestamptz expires_at
    }
    rate_limits {
        int id PK
        text key UK
        int count
        bigint last_request
    }
    recipes {
        int id PK
        int user_id FK
        varchar title "料理名 50 文字"
        varchar description "300 文字"
        smallint servings "1〜20"
        smallint cook_minutes "1〜600"
        category category "MAIN / SIDE / SOUP / STAPLE / DESSERT / OTHER"
        varchar image_key "写真のキー(なしは NULL)"
        timestamptz created_at
        timestamptz updated_at
    }
    ingredients {
        int id PK
        int recipe_id FK
        smallint position "表示順"
        varchar name "材料名"
        varchar quantity "分量"
    }
    steps {
        int id PK
        int recipe_id FK
        smallint position "手順の番号"
        varchar body "手順の文章"
    }
    favorites {
        int user_id PK, FK
        int recipe_id PK, FK
        timestamptz created_at
    }
    comments {
        int id PK
        int recipe_id FK
        int user_id FK
        varchar body
        timestamptz created_at
    }
```

- 外部キーはすべて削除時 CASCADE(ユーザーを消すとレシピ・お気に入りも消え、レシピを消すと材料・手順・お気に入りも消える)。
- `verifications`・`rate_limits` は他のテーブルと関連を持たない。`rate_limits` は Vercel で複数のインスタンスが動くため、メモリではなく DB に置いている。
- キーワード検索(部分一致)のため、`recipes.title` と `ingredients.name` に pg_trgm の GIN インデックスを張っている。

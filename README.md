# Task × Calendar

タスク管理とカレンダーを1つの画面にまとめたWebアプリです。未着手のタスクをリストから直接カレンダーへドラッグ&ドロップしてスケジュールを組めます。

## 背景

リマインダーアプリとカレンダーアプリを別々に使っていると、タスクを「いつやるか」考える際にアプリを行き来する必要があり面倒です。このアプリはタスク機能とカレンダー機能を1つにまとめることでその手間をなくします(詳細は [docs/01_spec.md](docs/01_spec.md) を参照)。

## 主な機能

- タスクの作成・編集・削除(タイトル / 説明 / カテゴリー / 所要時間 / 緊急度・重要度)
- カレンダーへのドラッグ&ドロップでのスケジューリング、繰り返し予定(毎日・毎週・毎月)
- カテゴリーごとのタスク一覧表示・ドラッグでの分類変更
- 同名タスクの重複チェック
- 操作履歴の確認(過去3日/7日/30日)
- メールアドレス + パスワードによるアカウント認証
- タスク機能のON/OFF切り替え(設定画面)

## 技術構成

- フロントエンド: [Vite](https://vitejs.dev/) + React + TypeScript
- カレンダーUI: [FullCalendar](https://fullcalendar.io/)
- サーバーAPI: Vercel Functions(`api/` フォルダ、ブラウザから直接DBには接続しない構成)
- DB: Postgres(Neon) + [Prisma](https://www.prisma.io/)
- 状態管理/データ取得: [TanStack Query](https://tanstack.com/query)
- デプロイ先: [Vercel](https://vercel.com/)(Hobbyプラン)

## ディレクトリ構成

```
src/            ブラウザ側のReactアプリ(DBには直接アクセスしない)
  api/          サーバーAPIを呼び出すクライアント(fetch)
  components/   画面コンポーネント(auth / calendar / history / layout / settings)
  hooks/        TanStack Queryを使ったデータ取得・更新フック
  lib/          バリデーションやエラー整形などの共通ロジック
api/            Vercel Functions(サーバー側。DB接続・認証はここに集約)
  auth/         サインアップ・ログイン・ログアウト・セッション確認
  tasks/        タスクCRUD・スケジューリング
  _lib/         Prismaクライアント、認証、共通HTTPユーティリティ
prisma/         DBスキーマとマイグレーション
shared/         フロント/バックエンド共通のバリデーションルール
docs/           企画・仕様ドキュメント
```

## セットアップ

### 必要なもの

- Node.js
- Vercel CLI(`npm i -g vercel`)
- Postgres接続情報(Vercel Dashboard の Storage、実体はNeon)

### 手順

```bash
npm install

# .env.local を用意する(DATABASE_URL / DIRECT_URL)
cp .env.local.example .env.local
# もしくは Vercel と連携済みなら:
vercel env pull .env.local

# Prisma Clientの生成 & マイグレーション適用
npm run prisma:generate
npm run prisma:migrate

# 開発サーバー起動
npm run dev
```

`.env.local` はGit管理外です(`.gitignore` 参照)。接続情報は各自のVercel/Neonダッシュボードから取得し、他人と共有しないでください。

## 主なスクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | Vite開発サーバーを起動 |
| `npm run build` | Prisma Client生成 + 本番ビルド |
| `npm run preview` | ビルド結果をローカルでプレビュー |
| `npm run prisma:generate` | Prisma Clientを生成 |
| `npm run prisma:migrate` | ローカルDBにマイグレーションを適用(`.env.local` を読み込む) |
| `npm run lint` | 型チェック(アプリ本体・Node設定・API個別) |

## デプロイ

Vercelにリポジトリを接続すると `vercel-build`(`prisma generate && prisma migrate deploy && vite build`)が実行され、マイグレーション適用とビルドが自動で行われます。DB接続情報はVercelプロジェクトの環境変数(Production/Preview/Development)に設定してください。

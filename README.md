# Task × Calendar

タスク管理とカレンダーを1つの画面にまとめたWebアプリです。未着手のタスクをリストから直接カレンダーへドラッグ&ドロップしてスケジュールを組めます。

## 背景

リマインダーアプリとカレンダーアプリを別々に使っていると、タスクを「いつやるか」考える際にアプリを行き来する必要があり面倒です。このアプリはタスク機能とカレンダー機能を1つにまとめることでその手間をなくします(詳細は [docs/01_spec.md](docs/01_spec.md) を参照)。

## 工夫した点

一番の工夫は、**タスクを「考えずに直感的に」スケジュールへ落とし込めること**です。タスクとカレンダーを別アプリで行き来する煩わしさをなくすという企画意図([背景](#背景))を、操作感のレベルまで落とし込むことを重視しました。

- **触った通りに動くドラッグ&ドロップ**: タスク一覧からカレンダーへドラッグすればそのままスケジュールされ、一覧内の別カテゴリー欄へドラッグすればそのまま分類が変わる。2種類のドラッグ(FullCalendarへの配置 / カテゴリー欄への移動)を同じ画面・同じジェスチャーで共存させ、ユーザーはどちらに向けたドラッグかを意識しなくてよいようにしている([TaskListPanel.tsx](src/components/calendar/TaskListPanel.tsx))。
- **スマホでも迷わない長押しリフト**: スマホ幅ではタスク一覧がカレンダーの上にあり、ドラッグしたくても目的地が画面外というすれ違いが起きる。長押しでタスクがふわっと浮き上がる演出と同時にカレンダーへ自動スクロールし、「持ち上げたらそのまま置き場所が見える」体験にした([TaskListPanel.tsx](src/components/calendar/TaskListPanel.tsx), [index.css](src/index.css))。
- **迷わせない重複タスクの確認**: 同じ名前のタスクを作ろうとしたときにエラーで止めるのではなく、「名前を変える」か「そのまま作る」かをその場で選べるダイアログを挟み、操作の流れを止めずに判断させている([useDuplicateTitleGuard.ts](src/hooks/useDuplicateTitleGuard.ts), [DuplicateTitleDialog.tsx](src/components/calendar/DuplicateTitleDialog.tsx))。

上記のUX面に加えて、土台となる作りにも次の点を配慮しています。

- **認証・DBアクセスの安全な設計**: パスワードは`scrypt`でソルト付きハッシュ化し、タイミング攻撃対策(`timingSafeEqual`)も実施。セッションもトークンをそのままDBに保存せずハッシュ化している。ブラウザ側(`src/`)は一切DBに直接アクセスせず、必ずVercel Functions(`api/`)を経由する構成にしている([auth.ts](api/_lib/auth.ts))。
- **繰り返し予定と操作履歴**: RRULEベースで毎日/毎週/毎月の繰り返しタスクに対応し、いつ・誰が・何を変更したかを`OperationHistory`として記録することで、共有カレンダーでの「誰かが操作した」問題に気づけるようにしている。

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

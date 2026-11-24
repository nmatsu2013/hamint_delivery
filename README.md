# hamint_delivery

医療製品（糸リフト・注射針など）を日本のクリニックから受注し、仕入先への発注・輸入・入庫・国内出荷・請求・入金までを一元管理する受発注システムです。

`spec/spec_detail.md` の詳細設計に基づき、**React SPA + Hono/TypeScript API + PostgreSQL** を実装しています。

## 実装範囲

| 領域 | 内容 |
|---|---|
| DB | `migration/create.sql`（21テーブル）＋ `0002_spec_detail.sql`（`audit_logs`、製品拡張列、監査トリガー）＋ `0003_harden_audit_logs.sql`＋`0004_remove_roles.sql`、シード |
| Server | domain / repository / service / handler のクリーンアーキテクチャ。UC-01〜UC-08、簡易認証、監査ログ |
| Frontend | 受注一覧（`spec/design_sample` 準拠：件数チップ・進み具合・コンパクト表示）・受注明細（8段階ステッパー）・新規受注・発注・輸入申請・入庫検品/ロット・出荷配送・請求入金・ロット追跡・マスタ参照 |
| テスト | Vitest 単体テスト23件 |

## 技術スタック

- TypeScript 5（strict）
- Server: Hono + `@hono/node-server`、Zod、`pg`、`jose`（簡易ログイン用JWT）
- Frontend: React 18 + Vite、React Router v6、TanStack Query、Zustand
- DB: PostgreSQL（Supabase想定。ローカルDockerでも可）
- Test: Vitest

## ディレクトリ

```
src/
├── server/
│   ├── domain/        # エンティティ・状態Enum・リポジトリIF・ドメインエラー
│   ├── repository/    # pgによる実装・トランザクション（UoW）
│   ├── service/       # ユースケース（UC-01〜UC-08）
│   ├── handler/       # Honoルート・Zod DTO・認証
│   ├── adapter/       # 外部サービス連携の置き場（現状は未使用）
│   ├── config/        # 環境変数・業務日付・定数
│   └── main.ts        # DI・サーバー起動
└── frontend/
    ├── components/    # 共通レイアウト・UI要素
    ├── features/      # 機能別のAPIクライアント・コンポーネント
    ├── pages/         # 画面
    ├── lib/           # APIクライアント・デザイントークン・フォーマッタ
    ├── store/         # Zustand（認証）
    └── styles/        # デザインサンプル準拠のCSS
```

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. 環境変数

```bash
cp .env.example .env
```

`.env` の `DATABASE_URL` に PostgreSQL（SupabaseのSession pooler推奨）を設定します。

| 変数 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL接続文字列（必須） |
| `PORT` | APIポート（既定 3000） |
| `CORS_ORIGIN` | 許可オリジン（カンマ区切り、`*`可） |
| `LOGIN_USER_ID` | 簡易ログインのユーザーID（既定 `hamint_user`） |
| `LOGIN_PASSWORD` | 簡易ログインのパスワード（既定 `hamint_password`） |
| `BUSINESS_DATE` | 受入テスト用に業務日付を固定（例 `2026-11-24`、通常は空） |
| `VITE_API_BASE_URL` | フロントのAPIベース（既定 `/api`） |

### 3. DBマイグレーション・シード

```bash
npm run db:migrate            # migration/*.sql をファイル名順に適用
npm run db:seed               # products が空のときだけサンプルデータを投入
npm run db:seed -- --reset    # 既存サンプルデータを削除して30件シードを再投入
```

既存のサンプルデータを新しい30件シードに置き換える場合は `--reset` を利用してください。

ローカルDockerで試す場合:

```bash
docker run -d --name hamint-postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hamint \
  -p 55432:5432 postgres:16-alpine

export DATABASE_URL=postgresql://postgres:postgres@localhost:55432/hamint
npm run db:setup   # migrate + seed
```

### 4. 起動

```bash
npm run dev
# API:      http://localhost:3000
# Frontend: http://localhost:5173
```

フロントの `/api` は Vite が `API_PROXY_TARGET`（既定 `http://localhost:3000`）へプロキシします。

### 5. ログイン

- ユーザーID: `hamint_user`
- パスワード: `hamint_password`
- ロール・権限分岐はありません。ログイン後はすべての画面と操作を利用できます。

## API概要

すべて `/api` 配下。認証ヘッダーは `Authorization: Bearer <token>`。

| 領域 | 主なエンドポイント |
|---|---|
| 認証・KPI | `GET /api/me`, `GET /api/dashboard/kpis` |
| 受注 | `GET/POST /api/sales-orders`, `GET /api/sales-orders/:id`, `PATCH /api/sales-orders/:id/cancel` |
| 発注 | `GET /api/purchase-orders`, `GET /api/purchase-orders/:id`, `POST /api/purchase-orders/create-from-so`, `POST /api/purchase-orders/:id/inspect` |
| 輸入 | `GET/POST /api/import-applications`, `PATCH /api/import-applications/:id/status` |
| 配送 | `GET /api/shipments`, `POST /api/shipments/international`, `POST /api/shipments/domestic`, `PATCH /api/shipments/:id/delivered` |
| ロット | `GET /api/lots/available`, `GET /api/lots/trace?lotNo=...` |
| 請求 | `GET/POST /api/invoices`, `GET /api/invoices/:id`, `POST /api/invoices/:id/payments`, `DELETE /api/invoices/:id`（確定済みは拒否） |
| マスタ | `GET /api/customers`, `GET /api/customers/:id/addresses`, `GET /api/products`, `GET /api/prices/resolve` |
| 監査 | `GET /api/audit-logs` |
| ログイン | `POST /api/auth/login` |

## 受入テスト結果

`BUSINESS_DATE=2026-11-25` のシードデータ（受注30件）でAPIを実行し、以下を確認済みです。

- AT-01: 受注30件の数量・金額・状態
- AT-02: KPI（本日2／受付7／輸入・輸送中5／未入金5／今月30）
- AT-03/04: 顧客別単価440、標準単価450
- AT-05: 標準単価変更後も登録済み単価440は不変
- AT-06: 受注明細から発注作成→受注が「発注済」
- AT-07: 国際輸送登録→受注が「輸入・輸送中」
- AT-08: 入庫検品→ロット生成・受注明細「入荷済」
- AT-09: 国内出荷→ロット減算・受注「出荷済」
- AT-10/11: 請求作成・入金消込・未入金額算出→受注「完了」
- AT-12: `SAMPLE-LOT-P004-01` → みどり美容外科（本院）50本
- AT-20: 数量0の受注→400
- AT-21: 同一出荷の再送→`alreadyProcessed=true`、在庫減算1回のみ
- AT-22: 受注数量超過の出荷→422
- AT-23: 使用期限切れロットの出荷→422
- AT-26: 未認証401
- AT-27: 確定済み請求の削除→422
- AT-28: `authenticated` ロールの `audit_logs` UPDATE/DELETE→permission denied

### 自動テスト

```bash
npm test          # Vitest 単体テスト
npm run typecheck # Server + Frontend の型チェック
npm run build     # Server(tsup) + Frontend(Vite) ビルド
```

## トラブルシューティング

### ログイン・初期画面で500エラーになる

1. APIサーバーが起動しているか確認

```bash
curl http://localhost:3000/api/health
```

2. DBマイグレーションとシードを適用

```bash
npm run db:migrate
npm run db:seed
```

既存DB（Supabaseで `create.sql` を手動適用済みなど）の場合、`create.sql` は自動で適用済みとして記録され、`0002_spec_detail.sql` 以降だけが適用されます。

3. SupabaseのSSL接続

`sslmode=require` / `prefer` / `verify-ca` の場合、Supabase Session poolerの証明書チェーンに対応するため、libpq互換（暗号化あり・CA検証なし）で接続します。CA検証を厳密に行う場合は `sslmode=verify-full` を利用してください。

開発環境では500レスポンスに `error.details.message` が含まれるため、サーバーターミナルのログと合わせて原因を確認できます。

## 実装上の注意

- **受注一覧の表示件数**: 画面はDBの実データを表示します。初期シードは30件です（受付7・発注済5・輸入/輸送中5・入荷済4・出荷済5・完了4）。`spec/design_sample/Main.dc.html` のレイアウト・色・列構成・進み具合表示に合わせています。
- **業務日付**: 通常は Asia/Tokyo の今日。受入テスト・デモでは `BUSINESS_DATE` で固定できます。採番（`so`/`po`/`in`/`sh`/`inv`/`ia`）は伝票日付を基準にします。
- **監査ログ**: 全業務テーブルに `AFTER INSERT/UPDATE/DELETE` トリガーを設定。操作者はトランザクション内の `app.user_id` から記録します。`audit_logs` は UPDATE/DELETE を REVOKE しています。
- **RLS**: `create.sql` で全テーブルのRLSを有効化しています。Supabaseの `authenticated` / `anon` 向けポリシーは運用設計が必要なため未定義です。`audit_logs` は改変拒否のみ実装済みです。
- **部分入荷**: `purchase_order_lines` の検品項目は1組のみのため、1明細につき1回の検品登録です（仕様の要確認事項どおり）。
- **消費税**: 10%固定・`floor` で計算。税区分・端数処理・請求書様式は要確認です。
- **為替・原価配分**: 仕入価格はKRWのまま保存し、為替換算・関税等の品目配分は未実装（要確認）。
- **PDF**: 発注書・請求書のPDF出力は未実装です（CSVは受注一覧で出力可能）。

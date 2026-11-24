# 受発注システム 詳細設計書（spec_detail.md）

本書は、`spec/spec.md`（要件定義書）、`migration/create.sql`（PostgreSQLスキーマ）、`migration/products-seed.sql`（サンプルデータ・シード）、および `spec/architecture.md`、`spec/design_sample/Main.dc.html` を元に、**DeepSeekや開発者が追加の推測を行わずにコードを実装できるレベル**まで具体化した詳細設計書である。

---

## 1. システム全体構成と技術スタック

### 1.1 アーキテクチャ方針
- **ディレクトリ構成**:
  - `src/frontend`: React (SPA) クライアント
  - `src/server`: クリーンアーキテクチャ（4層＋最内domain）に基づくNode.js / TypeScriptサーバー
  - フロントエンドとサーバーはHTTP/JSON API経由でのみ通信し、コードの直接インポートを行わない。
- **推奨技術選定**:
  - 言語: TypeScript 5.x（strictモード有効）
  - サーバーフレームワーク: Hono または Express / Fastify（軽量かつClean Architectureを損なわない薄いハンドラー）
  - バリデーション: Zod（リクエスト/レスポンスの型安全性を保証）
  - DBアクセス: PostgreSQLクライアント（`pg` または `postgres.js`、あるいはクエリビルダ `Kysely`）。スキーマと型の一致を厳密に保つ。
  - フロントエンド: React 18+, Vite, React Router v6, Tailwind CSS（またはCSS Modules）, Zustand（UI状態）, TanStack Query（サーバーキャッシュ）
  - 認証/DB基盤: Supabase（PostgreSQL + GoTrue Auth + Storage + RLS）

---

## 2. データベース・データモデル整合性仕様

### 2.1 スキーマとシードデータの差分吸収ルール
`migration/create.sql` のCHECK制約と `migration/products-seed.sql` の初期投入値の間にある表現差分は、以下の通り**DB内部値（物理値）とUI表示値（論理ラベル）を明確にマッピング**して実装する。

| 対象テーブル・カラム | DB内部値（物理値: create.sql準拠） | シード/UI表示値（日本語ラベル） | 実装ルール |
|---|---|---|---|
| `shipments.direction` | `'domestic'`<br>`'international'` | `'国内配送'`<br>`'国際輸送'` | DB保存・API内部値は英語コード (`domestic` / `international`) を使用し、UI表示時にマッピングする。シード実行時はDBのCHECK制約に従い英語コードで投入するか、Enum定数で相互変換する。 |
| `lot_movements.movement_type` | `'receipt'`<br>`'shipment'`<br>`'return'`<br>`'disposal'`<br>`'adjustment'` | `'入荷'`<br>`'出荷'`<br>`'返品'`<br>`'廃棄'`<br>`'調整'` | DB保存値は英語小文字コードとする。APIおよびUI表示時に日本語ラベルに変換。 |
| `products` 拡張項目 | `spec_note`（規格メモ）<br>`usage`（用途）<br>`priority_class`（主力区分） | 同左 | `create.sql` にカラムが存在しない場合は、`alter table products add column if not exists spec_note text;` 等のマイグレーションを追加して保持する。 |

### 2.2 状態値（Status Enums）定義一覧

| 対象カラム | 許容する内部値（文字列） | 説明・UIラベル |
|---|---|---|
| `sales_orders.status` | `draft`<br>`received` (受付)<br>`ordered` (発注済)<br>`in_transit` (輸入・輸送中)<br>`arrived` (入荷済)<br>`shipped` (出荷済)<br>`completed` (完了)<br>`cancelled` (取消) | 画面表示・シードでは日本語（`受付`, `発注済`, `輸入・輸送中`, `入荷済`, `出荷済`, `完了`, `取消`）が使用されているため、API入出力は日本語ラベルまたは固定Enumマッピングをサポートする。 |
| `sales_order_lines.line_status` | `received` (受付)<br>`ordered` (発注済)<br>`in_transit` (輸送中)<br>`arrived` (入荷済)<br>`shipped` (出荷済)<br>`completed` (完了)<br>`cancelled` (取消) | 明細ごとの進捗。親の受注状態は原則「最も遅い明細の状態」と同期する。 |
| `purchase_orders.status` | `draft` (下書き)<br>`ordered` (発注済)<br>`partially_received` (一部入荷)<br>`received` (入荷完了)<br>`cancelled` (取消) | 発注のライフサイクル。 |
| `import_applications.status` | `preparing` (書類準備中)<br>`applied` (申請済)<br>`reviewing` (確認中)<br>`approved` (承認)<br>`rejected` (差戻し) | 輸入申請のステータス。 |
| `shipments.status` | `preparing` (準備中)<br>`shipped` (発送済)<br>`delivered` (納品済)<br>`undelivered` (不達) | 国際輸送・国内配送共通。 |
| `invoices.status` | `unbilled` (未請求)<br>`issued` (請求済)<br>`partially_paid` (一部入金)<br>`paid` (入金済) | 請求ステータス。 |
| `lots.status` | `available` (使用可)<br>`on_hold` (保留)<br>`recalled` (回収) | ロットの利用可否。 |

### 2.3 監査ログテーブル (`audit_logs`)
要件 F-03 / AT-28 の「すべての登録・更新・取消を、操作者・日時・変更前後つきで記録し、通常ユーザーが改変・削除できない」を満たすため、DBに以下の監査テーブルを定義する。

```sql
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    user_id uuid,
    user_role text,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_table_record_idx ON audit_logs (table_name, record_id);
```

---

## 3. サーバー層別詳細設計（Clean Architecture）

依存ルール：
`handler` → `service` → `domain` ← `repository` / `adapter`
（最内層 `domain` はフレームワークやDB実装に依存しない）

```
src/server/
├── domain/
│   ├── entities/          # ドメインエンティティ（型・計算ロジック）
│   ├── repositories/      # リポジトリインターフェース
│   ├── gateways/          # 外部サービス・アダプタインターフェース
│   └── errors/            # ドメインエラークラス
├── service/               # ユースケース実装（ビジネスロジック）
├── repository/            # DBアクセス（PostgreSQL/Supabase）
├── adapter/               # ファイルストレージ、PDF出力等の実装
├── handler/               # HTTPルート、リクエスト/レスポンス制御
│   ├── dto/               # Zodスキーマ、型定義
│   └── middleware/        # 認証(Auth)、認可(RBAC)、監査ログ、エラーハンドラ
├── config/                # 環境変数、定数定義
└── main.ts                # DIおよびサーバースタートアップ
```

### 3.1 ドメイン層 (`src/server/domain/`)

#### 3.1.1 ドメインエラー (`domain/errors/domain.error.ts`)
```typescript
export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`, 'NOT_FOUND');
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_VIOLATION');
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN');
  }
}
```

#### 3.1.2 主要エンティティ (`domain/entities/`)
主要エンティティはTypeScriptのInterfaceおよび不変条件チェック用ファクトリ/メソッドとして定義する。

- **`SalesOrder` & `SalesOrderLine`**:
```typescript
export interface SalesOrderLineEntity {
  id: string;
  salesOrderId: string;
  productId: string;
  quantity: number;        // integer, > 0
  unitPrice: number;       // numeric, >= 0
  currency: string;        // 'JPY'
  lineStatus: string;      // '受付', '発注済', '輸送中', '入荷済', '出荷済', '完了', '取消'
  isActive: boolean;
  productName?: string;    // 表示用（結合時）
  modelNo?: string;
}

export interface SalesOrderEntity {
  id: string;
  orderNo: string;         // 'soYYMMDD-NN'
  orderDate: string;       // YYYY-MM-DD
  customerId: string;
  shipToId: string;
  requestedDate: string | null;
  status: string;          // '受付', '発注済', '輸入・輸送中', '入荷済', '出荷済', '完了', '取消'
  totalAmount: number;     // 税抜合計金額
  currency: string;        // 'JPY'
  note: string | null;
  isActive: boolean;
  lines: SalesOrderLineEntity[];
  createdAt: string;
  updatedAt: string;
}
```

- **`Lot` & `LotMovement`**:
```typescript
export interface LotEntity {
  id: string;
  productId: string;
  lotNo: string;
  expiryDate: string;      // YYYY-MM-DD
  manufacturedDate: string | null;
  purchaseOrderLineId: string | null;
  receivedQty: number;     // >= 0
  onHandQty: number;       // >= 0
  status: '使用可' | '保留' | '回収';
  isActive: boolean;
}

export interface LotMovementEntity {
  id: string;
  lotId: string;
  movementType: 'receipt' | 'shipment' | 'return' | 'disposal' | 'adjustment';
  quantity: number;        // 入庫は正数、出庫は正数（種別で減算判定）またはマイナス値
  sourceType: string;      // 'purchase_order_line', 'shipment_line'
  sourceId: string;
  customerId?: string | null;
  shipToId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}
```

#### 3.1.3 リポジトリインターフェース (`domain/repositories/`)
```typescript
export interface ISalesOrderRepository {
  findById(id: string): Promise<SalesOrderEntity | null>;
  findByOrderNo(orderNo: string): Promise<SalesOrderEntity | null>;
  list(params: {
    status?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: SalesOrderEntity[]; total: number }>;
  generateOrderNo(date: Date): Promise<string>;
  save(order: SalesOrderEntity): Promise<void>;
  updateStatus(id: string, status: string, updatedBy: string): Promise<void>;
}

export interface IPriceRepository {
  resolveCustomerUnitPrice(customerId: string, productId: string, targetDate: string): Promise<number | null>;
  resolveStandardUnitPrice(productId: string, targetDate: string): Promise<number | null>;
  resolveSupplierCost(productId: string, targetDate: string): Promise<{ cost: number; currency: string } | null>;
}

export interface ILotRepository {
  findById(id: string): Promise<LotEntity | null>;
  findByProductAndLotNo(productId: string, lotNo: string): Promise<LotEntity | null>;
  findAvailableLotsByProductFIFO(productId: string, minExpiryDate: string): Promise<LotEntity[]>;
  save(lot: LotEntity): Promise<void>;
  updateOnHandQty(lotId: string, delta: number): Promise<void>;
  createMovement(movement: LotMovementEntity): Promise<void>;
  getTraceability(lotNo: string): Promise<Array<{
    customerName: string;
    shipToName: string;
    address: string;
    shippedDate: string;
    quantity: number;
    trackingNo: string;
  }>>;
}

export interface IPurchaseOrderRepository {
  findById(id: string): Promise<any | null>;
  findByOrderLineId(salesOrderLineId: string): Promise<any | null>;
  generatePoNo(date: Date): Promise<string>;
  save(po: any): Promise<void>;
  updateReceived(orderLineId: string, data: {
    receivedDate: string;
    goodQty: number;
    defectQty: number;
    damagedQty: number;
    inspectorId: string;
    claimStatus?: string;
  }): Promise<void>;
}

export interface IShipmentRepository {
  save(shipment: any, lines: any[]): Promise<void>;
  findById(id: string): Promise<any | null>;
  findExistingByOrderLine(salesOrderLineId: string): Promise<any[]>;
}

export interface IInvoiceRepository {
  save(invoice: any, lines: any[]): Promise<void>;
  findById(id: string): Promise<any | null>;
  findBySalesOrderId(salesOrderId: string): Promise<any[]>;
  savePayment(payment: any): Promise<void>;
  getTotalPaidAmount(invoiceId: string): Promise<number>;
}
```

---

### 3.2 サービス層（ユースケース実装仕様）

#### UC-01: 単価解決ロジック（`PriceService.resolveUnitPrice`）
1. `customer_prices` テーブルを検索:
   - 条件: `customer_id = :customerId AND product_id = :productId AND valid_from <= :targetDate AND valid_to >= :targetDate AND is_active = true`
   - 見つかった場合: その `unit_price` を返す。
2. 見つからない場合、標準単価（`customer_id IS NULL`）を検索:
   - 条件: `customer_id IS NULL AND product_id = :productId AND valid_from <= :targetDate AND valid_to >= :targetDate AND is_active = true`
   - 見つかった場合: その `unit_price` を返す。
3. いずれも見つからない場合: `BusinessRuleViolationError("製品の有効な単価が設定されていません")` を投げる。

#### UC-02: 受注登録（`SalesOrderService.createOrder`）
- **入力**: 顧客ID (`customerId`)、配送先ID (`shipToId`)、希望納期 (`requestedDate`)、備考 (`note`)、明細配列 `[{ productId, quantity }]`
- **検証**:
  - `quantity > 0` かつ整数。
  - `products.is_active = true` であること。
  - `shipToId` が該当顧客に所属していること。
- **処理手順**:
  1. トランザクション開始。
  2. 今日の日付で `order_no` を採番（例: `so261124-01` 等、当日連番）。
  3. 各明細について `PriceService.resolveUnitPrice(customerId, productId, today)` を呼び出し、`unitPrice` を確定。
  4. `totalAmount = Σ(quantity * unitPrice)` を計算。
  5. `sales_orders` レコードを `status = '受付'` で作成。
  6. `sales_order_lines` レコードを `line_status = '受付'` で一括作成。
  7. 監査ログ `audit_logs` に `INSERT` を記録。
  8. トランザクションコミット。作成された受注エンティティを返却。

#### UC-03: 発注生成・確定（`PurchaseOrderService.createAndConfirmPo`）
- **入力**: 受注明細ID配列 `salesOrderLineIds`、納品回答日 (`promisedDate`)、備考
- **処理手順**:
  1. 指定された各受注明細（`line_status = '受付'`）を取得。
  2. 各明細の `productId` から `supplier_id` を特定し、仕入先ごとにグルーピング。
  3. 仕入先ごとに:
     - `po_no` を自動採番（`poYYMMDD-NN`）。
     - 各製品の `supplier_prices` から `unit_cost` と `currency` を取得。
     - `purchase_orders` を `status = '発注済'` で作成。
     - `purchase_order_lines` を作成し、`sales_order_line_id` と1対1で紐づける。
     - 対応する `sales_order_lines.line_status` を `'発注済'` に更新。
  4. 関連する `sales_orders` の全明細が発注済以上になった場合、親の `sales_orders.status` を `'発注済'` に更新。
  5. トランザクションコミット。

#### UC-04: 国際輸送・発送登録（`ShipmentService.registerInternationalDeparture`）
- **入力**: 発注ID (`purchaseOrderId`)、配送業者 (`carrier`)、AWB/BL番号 (`blAwbNo`)、発送日 (`shippedDate`)、ETD, ETA
- **処理手順**:
  1. `shipments` レコードを作成:
     - `direction = 'international'`（表示: 国際輸送）
     - `purchase_order_id = purchaseOrderId`
     - `status = '発送済'`, `shipped_date = shippedDate`
  2. 発注に紐づく受注明細の `line_status` を `'輸送中'` に更新。
  3. 受注の `status` を `'輸入・輸送中'` に更新（要件 F-41 / AT-07）。

#### UC-05: 入庫・検品・ロット生成（`WarehouseService.inspectAndReceive`）
- **入力**: 発注明細ID (`poLineId`)、入庫日 (`receivedDate`)、良品数 (`goodQty`)、不良数 (`defectQty`)、破損数 (`damagedQty`)、ロット番号 (`lotNo`)、使用期限 (`expiryDate`)、製造日 (`manufacturedDate` 任意)
- **検証**:
  - `goodQty + defectQty + damagedQty == purchase_order_lines.quantity`
  - `goodQty > 0` の場合、`lotNo` および `expiryDate` は必須入力。
- **処理手順**:
  1. `purchase_order_lines` の `received_date`, `good_qty`, `defect_qty`, `damaged_qty`, `inspector_id` を更新。
  2. 良品数 `goodQty > 0` の場合:
     - `lots` テーブルにレコード作成（または既存同ロットがあれば在庫加算）:
       - `received_qty = goodQty`, `on_hand_qty = goodQty`, `status = '使用可'`
     - `lot_movements` テーブルに履歴作成:
       - `movement_type = 'receipt'`, `quantity = goodQty`, `source_type = 'purchase_order_line'`, `source_id = poLineId`
  3. 不良・破損があった場合は `claim_status = 'メーカーへ連絡'` などのクレーム初期状態を設定（要件 F-50）。
  4. 受注明細の `line_status` を `'入荷済'` に更新。
  5. 受注の全明細が入荷済になれば受注 `status` を `'入荷済'` に更新。

#### UC-06: 国内出荷・FIFOロット引当（`ShipmentService.shipDomesticOrder`）
- **入力**: 受注ID (`salesOrderId`)、配送業者 (`carrier`)、追跡番号 (`trackingNo`)、発送日 (`shippedDate`)、出荷明細配列 `[{ salesOrderLineId, lotId, quantity }]`
- **検証**:
  - **二重送信防止（冪等性）**: 当該受注明細が既に出荷完了していないかチェック（AT-21）。
  - **数量チェック**: 各明細の出荷数量 `quantity <= (受注数量 - 既出荷数量)`（AT-22）。
  - **使用期限チェック**: 指定されたロットの `expiry_date < today` の場合は出荷拒否（AT-23）。
  - **在庫チェック**: 各ロットの `on_hand_qty >= quantity`。
  - **先入先出（FIFO）チェック**: より使用期限が早い利用可能ロットが存在する場合、警告または理由記録を求める（要件 F-61）。
- **処理手順**:
  1. トランザクション開始。
  2. `shipments` レコード作成:
     - `direction = 'domestic'`, `sales_order_id = salesOrderId`, `ship_to_id = shipToId`, `carrier = carrier`, `tracking_no = trackingNo`, `shipped_date = shippedDate`, `status = '発送済'`
  3. 各出荷明細について:
     - `shipment_lines` 作成 (`lot_id = lotId`, `quantity = quantity`)。
     - `lots.on_hand_qty = on_hand_qty - quantity` を更新。
     - `lot_movements` に記録:
       - `movement_type = 'shipment'`, `quantity = -quantity` (または正数+種別shipment), `source_type = 'shipment_line'`, `source_id = shipmentLineId`, `customer_id = customerId`, `ship_to_id = shipToId`
     - 受注明細の `line_status` を出荷済みに更新。
  4. 受注のすべての明細が出荷完了した場合、受注の `status` を `'出荷済'` に更新（要件 F-63, F-64）。
  5. トランザクションコミット。

#### UC-07: 請求作成と入金消込（`BillingService.createInvoiceAndPay`）
- **請求作成**:
  - 出荷済みの受注明細から作成。
  - 税抜合計 = `Σ(line.amount)`。消費税 = `floor(税抜合計 * 0.10)`。
  - `invoices.amount`（税込） = 税抜合計 + 消費税。`status = '請求済'`。
- **入金登録**:
  - 入金額 `paidAmount`、入金日 `paidDate`、入金方法 `method` を登録。
  - `payments` レコードを作成。
  - 累計入金額 `sum(paid_amount)` を集計。
  - `sum(paid_amount) >= invoices.amount` の場合:
    - `invoices.status = '入金済'`
    - 紐づく受注の `status = '完了'` に遷移（要件 F-74 / AT-10）。
  - `0 < sum(paid_amount) < invoices.amount` の場合:
    - `invoices.status = '一部入金'`
  - 未入金額は保存せず `invoices.amount - sum(paid_amount)` として動的計算（要件 F-73 / AT-11）。

#### UC-08: ロット追跡・回収検索（`TraceabilityService.traceLot`）
- **入力**: ロット番号 `lotNo`
- **処理手順**:
  1. `lots` より `lotNo` で検索。
  2. 当該ロットIDの `lot_movements`（`movement_type = 'shipment'`）を取得。
  3. `customers`, `customer_addresses`, `shipments` を結合。
  4. 納品先クリニック名、配送先住所・受取人、出荷日、数量、追跡番号のリストを返却（要件 F-55 / AT-12）。

---

### 3.3 REST API エンドポイント一覧とDTO仕様 (`handler/`)

すべてのAPIは `/api` プレフィックスを持ち、JSONリクエスト/レスポンスで通信する。
認証ヘッダー: `Authorization: Bearer <supabase_jwt_token>`

#### 3.3.1 認証・ダッシュボード
| Method | Path | 役割 | 概要 |
|---|---|---|---|
| `GET` | `/api/me` | 全員 | ログイン中ユーザーのプロフィールと権限（Role）の取得 |
| `GET` | `/api/dashboard/kpis` | 全員 | 受注一覧上部のKPIカード4指標の取得（AT-02） |

**`GET /api/dashboard/kpis` レスポンス DTO**:
```json
{
  "todayOrdersCount": 2,       // 受注日が本日の件数
  "pendingOrdersCount": 2,     // 状態が「受付」の件数
  "inTransitOrdersCount": 1,   // 状態が「輸入・輸送中」の件数
  "unpaidInvoicesCount": 1     // 請求済で未入金の件数
}
```

#### 3.3.2 受注管理 (Sales Orders)
| Method | Path | 許可Role | 概要 |
|---|---|---|---|
| `GET` | `/api/sales-orders` | 全員 | 受注一覧取得（検索・ステータス絞り込み・ページネーション） |
| `GET` | `/api/sales-orders/:id` | 全員 | 受注明細・関連情報（発注・輸送・出荷・請求）の取得 |
| `POST` | `/api/sales-orders` | 営業, 管理者 | 受注新規登録（AT-03, AT-20） |
| `PATCH` | `/api/sales-orders/:id/cancel` | 営業, 管理者 | 受注取消（未出荷のみ） |

**`POST /api/sales-orders` リクエスト DTO (Zod)**:
```typescript
export const CreateSalesOrderSchema = z.object({
  customerId: z.string().uuid(),
  shipToId: z.string().uuid(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().optional(),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive({ message: "数量は1以上の整数である必要があります" }) // AT-20
  })).min(1, { message: "明細を1件以上入力してください" })
});
```

#### 3.3.3 発注管理 (Purchase Orders)
| Method | Path | 許可Role | 概要 |
|---|---|---|---|
| `GET` | `/api/purchase-orders` | 購買, 経理, 管理 | 発注一覧取得 |
| `POST` | `/api/purchase-orders/create-from-so` | 購買, 管理者 | 受注明細からの発注作成・確定（AT-06） |
| `GET` | `/api/purchase-orders/:id` | 購買, 倉庫, 経理, 管理 | 発注詳細・明細取得 |

#### 3.3.4 輸入・輸送管理 (Import & Shipments)
| Method | Path | 許可Role | 概要 |
|---|---|---|---|
| `POST` | `/api/import-applications` | 購買, 管理者 | 輸入申請の登録 |
| `PATCH` | `/api/import-applications/:id/status` | 購買, 管理者 | 輸入申請のステータス更新（承認/差戻し等） |
| `POST` | `/api/shipments/international` | 購買, 管理者 | 国際輸送の発送日・AWB登録（AT-07） |
| `POST` | `/api/shipments/domestic` | 倉庫, 管理者 | 国内配送の出荷確定・ロット引当（AT-09, AT-21, AT-22, AT-23） |

**`POST /api/shipments/domestic` リクエスト DTO**:
```typescript
export const CreateDomesticShipmentSchema = z.object({
  salesOrderId: z.string().uuid(),
  carrier: z.string().min(1),
  trackingNo: z.string().min(1),
  shippedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(z.object({
    salesOrderLineId: z.string().uuid(),
    lotId: z.string().uuid(),
    quantity: z.number().int().positive()
  })).min(1)
});
```

#### 3.3.5 入庫・検品・ロット (Warehouse & Lots)
| Method | Path | 許可Role | 概要 |
|---|---|---|---|
| `POST` | `/api/purchase-orders/:id/inspect` | 倉庫, 管理者 | 検品結果登録・ロット生成（AT-08） |
| `GET` | `/api/lots/trace` | 倉庫, 経理, 管理 | ロット番号による納品先追跡検索（AT-12） |
| `GET` | `/api/lots/available` | 倉庫, 管理者 | 出荷用有効ロット一覧取得（FIFOソート） |

#### 3.3.6 請求・入金 (Invoices & Payments)
| Method | Path | 許可Role | 概要 |
|---|---|---|---|
| `POST` | `/api/invoices` | 経理, 管理者 | 請求データ作成 |
| `POST` | `/api/invoices/:id/payments` | 経理, 管理者 | 入金登録・消込（AT-10, AT-11） |
| `GET` | `/api/invoices/:id` | 経理, 管理者 | 請求・入金詳細取得 |

#### 3.3.7 マスタ参照
| Method | Path | 許可Role | 概要 |
|---|---|---|---|
| `GET` | `/api/customers` | 営業, 管理者 | 顧客一覧取得 |
| `GET` | `/api/customers/:id/addresses` | 営業, 管理者 | 配送先候補取得（デフォルト初期選択） |
| `GET` | `/api/products` | 全員 | 有効製品一覧取得（`is_active = true` のみ） |
| `GET` | `/api/prices/resolve` | 営業, 管理者 | 単価の事前解決（顧客×製品） |

---

## 4. 認可制御（RBAC）とセキュリティ仕様

### 4.1 役割とパーミッションマトリクス
`spec/spec.md` 第4.3章に基づくロール別認可制御。サーバーミドルウェア `authorize(allowedRoles)` で強制する。

| 操作機能 | 営業 (`sales`) | 購買 (`purchasing`) | 倉庫 (`warehouse`) | 経理 (`accounting`) | 管理者 (`admin`) |
|---|:---:|:---:|:---:|:---:|:---:|
| 受注登録・変更 | ○ | × | × | × | ○ |
| 受注閲覧 | ○ | ○ | ○ | ○ | ○ |
| 発注登録・確定 | × | ○ | × | × | ○ |
| 輸入申請・通関情報 | × | ○ | △ | △ | ○ |
| 国際輸送登録 | × | ○ | △ | × | ○ |
| 入庫・検品・ロット登録 | × | △ | ○ | × | ○ |
| 国内出荷・配送 | △ | × | ○ | × | ○ |
| 請求・入金 | × | × | × | ○ | ○ |
| **仕入価格・原価の閲覧** | **×（不可）** | **○** | **×（不可）** | **○** | **○** |
| マスタ変更・権限管理 | × | × | × | × | ○ |

### 4.2 フィールドレベルマスキング仕様
- 営業担当（`sales`）が受注や発注を参照する際、レスポンス内の `unit_cost`、`duty_amount`、`supplier_prices` 関連フィールドはシリアライズ時に `undefined` または `null` としてマスキングし、クライアントに渡さない（AT-25）。
- 倉庫担当（`warehouse`）に対しても同様に金額詳細をマスキングする。

---

## 5. フロントエンド詳細設計（`src/frontend/`）

### 5.1 デザインシステムトークン（`Main.dc.html` 準拠）
`spec/design_sample/Main.dc.html` から抽出したスタイル定義を厳格に共通定数/Tailwindクラスとして定義する。

```typescript
export const DESIGN_TOKENS = {
  colors: {
    bg: '#FFFFFF',
    textMain: '#1A2B42',
    textMuted: '#5B6B80',
    headerBg: '#162840',
    headerActiveBorder: '#4FD1C0',
    accentButton: '#00A497',
    accentText: '#2A7F6C',
    cardBg: '#F6F8FA',
    borderLight: '#E1E7EE',
    borderTable: '#DDE5EE',
    tableHeaderBg: '#ECF0F4',
  },
  statusPills: {
    '受付': { bg: '#EAF0F5', fg: '#3F5068' },
    '発注済': { bg: '#DDF0E8', fg: '#1F6B57' },
    '輸入・輸送中': { bg: '#FFEFC7', fg: '#6E4700' },
    '出荷済': { bg: '#DDEBFA', fg: '#1F4E86' },
    '完了': { bg: '#E3E8EE', fg: '#3F5068' },
    '取消': { bg: '#FDE8E8', fg: '#9B1C1C' }
  },
  kpiColors: {
    today: '#00A497',      // 本日の受注
    pending: '#7DB7E8',    // 発注待ち（受付）
    inTransit: '#E0A92B',  // 輸入・輸送中
    unpaid: '#D9604F'      // 未入金
  },
  paymentStatusColors: {
    '未請求': '#5B6B80',
    '未入金（請求済）': '#9A2B1F',
    '入金済': '#14633A'
  }
};
```

### 5.2 画面一覧とURLルーティング
| 画面名 | ルートパス | 主なコンポーネント |
|---|---|---|
| 受注一覧（デザイン済） | `/orders` | `SalesOrdersListPage` |
| 受注明細（デザイン済） | `/orders/:id` | `SalesOrderDetailPage` |
| 新規受注登録 | `/orders/new` | `CreateSalesOrderPage` |
| 発注管理一覧・作成 | `/purchase-orders` | `PurchaseOrdersPage` |
| 輸入・国際輸送一覧 | `/imports` | `ImportsPage` |
| 入庫検品・ロット管理 | `/warehouse` | `WarehousePage` |
| 出荷配送登録 | `/shipments` | `ShipmentsPage` |
| 請求・入金管理 | `/billing` | `BillingPage` |
| ロット回収・追跡 | `/traceability` | `TraceabilityPage` |

### 5.3 主要画面のコンポーネント構成詳細

#### 5.3.1 受注一覧画面 (`features/salesOrders/`)
```
src/frontend/features/salesOrders/
├── api/
│   ├── getSalesOrders.ts     # GET /api/sales-orders
│   └── getDashboardKpis.ts   # GET /api/dashboard/kpis
├── components/
│   ├── KpiCards.tsx          # 4つの指標カード（グリッド表示）
│   ├── StatusFilterPills.tsx # 「すべて/受付/発注済/輸入・輸送中/出荷済/完了」タブ
│   ├── SearchInput.tsx       # 顧客名・受注番号・製品名検索窓
│   └── SalesOrdersTable.tsx  # 一覧テーブル（デザイン完全一致）
└── types/
    └── index.ts
```

- **受注一覧テーブルの表示ロジック**:
  - `主な製品`: 明細が1点ならその製品名、複数なら「先頭1製品名 ＋ ほか○点」（例: `Fiora thread Cog 360 ほか1点`）。
  - `金額（税抜）`: `¥` 記号＋3桁カンマ区切り（`¥246,000`）。
  - `入金状況`: 請求および入金状況から「未請求」「未入金（請求済）」「入金済」を自動判定し、対応するカラーで表示。
  - `明細を開く ↗`: ボタン押下で `/orders/:id` に遷移。

#### 5.3.2 受注明細画面 (`features/salesOrders/components/OrderDetailView.tsx`)
- **進捗ステッパー（8段階表示）**:
  1. 受注登録済
  2. 発注確定済
  3. 輸入申請承認
  4. 輸送・通関許可
  5. 入庫・検品済
  6. 国内出荷済
  7. 納品完了
  8. 入金消込完了
- **タブ/セクション構成**:
  - 受注基本情報（顧客名、配送先、受注日、希望納期、合計金額）
  - 明細テーブル（製品名、規格、数量、確定単価、金額、明細ステータス）
  - 紐づく発注情報・輸入申請進捗
  - 出荷情報（ロット番号、追跡番号、配送業者、納品日）
  - 請求・入金履歴

---

## 6. 受入テスト（AT-01 〜 AT-29）実装・検証仕様

DeepSeekおよび開発者が自動テスト（Vitest / Jest / Playwright）を実装する際のテストシナリオ定義。

### 6.1 業務シナリオ（正常系）

```typescript
describe('業務シナリオ受入テスト (AT-01 ~ AT-12)', () => {
  // AT-01: 受注一覧の初期表示
  it('AT-01: サンプルの6件が正しい数量・金額・状態で取得できる', async () => {
    const res = await api.get('/api/sales-orders');
    expect(res.items).toHaveLength(6);
    expect(res.items.find(o => o.orderNo === 'so261105-01').status).toBe('完了');
    expect(res.items.find(o => o.orderNo === 'so261112-02').status).toBe('出荷済');
    expect(res.items.find(o => o.orderNo === 'so261120-01').status).toBe('輸入・輸送中');
    expect(res.items.find(o => o.orderNo === 'so261122-01').status).toBe('発注済');
    expect(res.items.find(o => o.orderNo === 'so261124-02').status).toBe('受付');
    expect(res.items.find(o => o.orderNo === 'so261124-03').status).toBe('受付');
  });

  // AT-02: 件数カード集計
  it('AT-02: KPIカード集計値が仕様通りである', async () => {
    const kpis = await api.get('/api/dashboard/kpis');
    expect(kpis.todayOrdersCount).toBe(2);      // so261124-02, so261124-03
    expect(kpis.pendingOrdersCount).toBe(2);    // 受付 2件
    expect(kpis.inTransitOrdersCount).toBe(1);  // 輸入・輸送中 1件
    expect(kpis.unpaidInvoicesCount).toBe(1);   // みどり美容外科 1件
  });

  // AT-03 & AT-04: 単価解決（顧客別 vs 標準）
  it('AT-03: みなと皮膚科クリニックで P007 を指定した場合、顧客別単価 440 円が適用される', async () => {
    const minato = await getCustomerByCode('C002');
    const p007 = await getProductByCode('P007');
    const price = await priceService.resolveUnitPrice(minato.id, p007.id, '2026-11-24');
    expect(price).toBe(440);
  });

  it('AT-04: 他の顧客（C001）で P007 を指定した場合、標準単価 450 円が適用される', async () => {
    const sakura = await getCustomerByCode('C001');
    const p007 = await getProductByCode('P007');
    const price = await priceService.resolveUnitPrice(sakura.id, p007.id, '2026-11-24');
    expect(price).toBe(450);
  });

  // AT-05: 登録後の単価独立性
  it('AT-05: マスタの標準単価を変更しても、登録済み受注明細の単価は変わらない', async () => {
    const p007 = await getProductByCode('P007');
    await updateStandardPrice(p007.id, 999);
    const existingOrder = await salesOrderRepo.findByOrderNo('so261124-02');
    expect(existingOrder.lines[0].unitPrice).toBe(440); // 過去データ不変
  });

  // AT-06: 発注確定連携
  it('AT-06: 受付の受注から発注を作成・確定すると、受注状態が発注済になり明細が紐づく', async () => {
    const order = await salesOrderRepo.findByOrderNo('so261124-03');
    const po = await purchaseOrderService.createAndConfirmPo({
      salesOrderLineIds: order.lines.map(l => l.id)
    });
    const updatedOrder = await salesOrderRepo.findByOrderNo('so261124-03');
    expect(updatedOrder.status).toBe('発注済');
  });

  // AT-07: 国際輸送連携
  it('AT-07: 国際輸送の発送日を登録すると、受注状態が「輸入・輸送中」になる', async () => {
    const po = await poRepo.findByPoNo('po261121-01');
    await shipmentService.registerInternationalDeparture({
      purchaseOrderId: po.id,
      shippedDate: '2026-11-24',
      carrier: 'DHL',
      blAwbNo: 'SAMPLE-AWB-0001'
    });
    const order = await salesOrderRepo.findByOrderNo('so261120-01');
    expect(order.status).toBe('輸入・輸送中');
  });

  // AT-08: 入庫検品とロット登録
  it('AT-08: 入庫検品を完了すると良品がロット登録され、受注明細が入荷済になる', async () => {
    const res = await warehouseService.inspectAndReceive({
      poLineId: '...',
      receivedDate: '2026-11-25',
      goodQty: 40,
      defectQty: 0,
      damagedQty: 0,
      lotNo: 'NEW-LOT-01',
      expiryDate: '2028-12-31'
    });
    const lot = await lotRepo.findByProductAndLotNo(res.productId, 'NEW-LOT-01');
    expect(lot.onHandQty).toBe(40);
    expect(res.orderLineStatus).toBe('入荷済');
  });

  // AT-09: 出荷登録とロット減算
  it('AT-09: 国内出荷を登録するとロット在庫が減算され、受注状態が出荷済になる', async () => {
    const lotBefore = await lotRepo.findByProductAndLotNo('...', 'SAMPLE-LOT-P004-01');
    await shipmentService.shipDomesticOrder({
      salesOrderId: '...',
      carrier: 'ヤマト運輸',
      trackingNo: 'TRK-999',
      shippedDate: '2026-11-25',
      lines: [{ salesOrderLineId: '...', lotId: lotBefore.id, quantity: 10 }]
    });
    const lotAfter = await lotRepo.findById(lotBefore.id);
    expect(lotAfter.onHandQty).toBe(lotBefore.onHandQty - 10);
  });

  // AT-10 & AT-11: 請求と入金消込
  it('AT-10 & AT-11: 請求の未入金額算出と全額入金時の完了ステータス遷移', async () => {
    // AT-11 未入金額検証
    const inv = await invoiceRepo.findByInvoiceNo('inv261123-01');
    const balance = await billingService.getUnpaidBalance(inv.id);
    expect(balance).toBe(225500); // 請求225,500, 入金0

    // AT-10 入金消込
    await billingService.recordPayment({
      invoiceId: inv.id,
      paidAmount: 225500,
      paidDate: '2026-11-25'
    });
    const paidInv = await invoiceRepo.findById(inv.id);
    expect(paidInv.status).toBe('入金済');
    const order = await salesOrderRepo.findByOrderNo('so261112-02');
    expect(order.status).toBe('完了');
  });

  // AT-12: トレーサビリティ回収検索
  it('AT-12: ロット番号 SAMPLE-LOT-P004-01 を検索するとみどり美容外科（本院）への納品が取得できる', async () => {
    const trace = await traceabilityService.traceLot('SAMPLE-LOT-P004-01');
    expect(trace).toHaveLength(1);
    expect(trace[0].customerName).toBe('みどり美容外科');
    expect(trace[0].shipToName).toBe('本院');
    expect(trace[0].quantity).toBe(50);
  });
});
```

### 6.2 異常系・安全性シナリオ

```typescript
describe('異常系・安全性受入テスト (AT-20 ~ AT-28)', () => {
  it('AT-20: 数量0以下での受注登録はバリデーションエラーで拒否される', async () => {
    await expect(salesOrderService.createOrder({
      customerId: '...', shipToId: '...', lines: [{ productId: '...', quantity: 0 }]
    })).rejects.toThrow(ValidationError);
  });

  it('AT-21: 同じ出荷確定を二重送信しても、ロットの減算は1回のみ実行される（冪等性）', async () => {
    const payload = { salesOrderId: '...', lines: [...] };
    const res1 = await shipmentService.shipDomesticOrder(payload);
    const res2 = await shipmentService.shipDomesticOrder(payload);
    expect(res2.alreadyProcessed).toBe(true);
    // 在庫が2重に減っていないことを確認
  });

  it('AT-22: 受注数量を超えた出荷登録は拒否される', async () => {
    await expect(shipmentService.shipDomesticOrder({
      salesOrderId: '...', lines: [{ salesOrderLineId: '...', quantity: 99999 }]
    })).rejects.toThrow(BusinessRuleViolationError);
  });

  it('AT-23: 使用期限切れのロットを出荷しようとすると拒否される', async () => {
    const expiredLot = await createExpiredLot();
    await expect(shipmentService.shipDomesticOrder({
      salesOrderId: '...', lines: [{ lotId: expiredLot.id, quantity: 10 }]
    })).rejects.toThrow(BusinessRuleViolationError);
  });

  it('AT-24: 営業ロールのユーザーが発注・入荷・請求APIを呼び出すと403 Forbiddenになる', async () => {
    const res = await requestAsRole('sales').post('/api/purchase-orders/create-from-so');
    expect(res.status).toBe(403);
  });

  it('AT-25: 営業ロールのユーザーが受注詳細を取得した際、仕入価格・原価情報がnullにマスクされる', async () => {
    const res = await requestAsRole('sales').get('/api/sales-orders/so261105-01');
    expect(res.data.lines[0].purchaseUnitCost).toBeUndefined();
  });

  it('AT-26: 未認証アクセスはすべて 401 Unauthorized となり業務データを取得できない', async () => {
    const res = await unauthenticatedRequest.get('/api/sales-orders');
    expect(res.status).toBe(401);
  });

  it('AT-27: 確定済みの請求レコードの物理削除は拒否される', async () => {
    await expect(invoiceRepo.delete('...')).rejects.toThrow();
  });

  it('AT-28: 通常ユーザー権限で audit_logs の更新・削除クエリを実行すると拒否される', async () => {
    await expect(db.query('DELETE FROM audit_logs')).rejects.toThrow();
  });
});
```

---

## 7. 実装ステップとファイル作成ロードマップ

DeepSeekまたはエンジニアは以下の順序で実装を進めること：

1. **Step 1: DB接続・マイグレーション適用**
   - `migration/create.sql` を実行し、全21テーブル + トリガー + RLS基盤を構築。
   - `audit_logs` テーブルを作成。
   - `migration/products-seed.sql` のシードデータを投入。
2. **Step 2: Server 最内層 (Domain)**
   - `src/server/domain/errors/domain.error.ts`
   - `src/server/domain/entities/*.entity.ts`
   - `src/server/domain/repositories/*.repository.interface.ts`
3. **Step 3: Server 外側 (Repository & Adapter)**
   - PostgreSQLクエリを用いたリポジトリ実装（`src/server/repository/*.repository.ts`）
   - トランザクションヘルパーの実装
4. **Step 4: Server 内側 (Service)**
   - `PriceService`（単価解決）
   - `SalesOrderService`（受注管理）
   - `PurchaseOrderService`（発注管理）
   - `ShipmentService`（国際輸送・国内出荷・FIFO引当）
   - `WarehouseService`（検品・ロット）
   - `BillingService`（請求・入金）
   - `TraceabilityService`（ロット追跡）
5. **Step 5: Server 最外層 (Handler & Router)**
   - DTO & Zodスキーマ（`src/server/handler/dto/`）
   - 認証・RBACミドルウェア（`src/server/handler/middleware/`）
   - 各リソースのハンドラー・ルーティング定義
   - `src/server/main.ts` でのDIコンテナ組み立てとサーバー起動
6. **Step 6: Frontend 基盤 & デザインシステム**
   - Tailwind / CSSスタイル設定（`DESIGN_TOKENS` 反映）
   - 共通レイアウト（`Header`, `Navigation`）
7. **Step 7: Frontend 機能実装**
   - `features/salesOrders/`（受注一覧・KPIカード・受注明細・新規受注登録）
   - `features/warehouse/`（ロット検索・入庫検品）
   - 各画面のAPIクライアント連携
8. **Step 8: テスト自動化・受入検証**
   - AT-01 〜 AT-29 のテストスイート実行・オールグリーン検証

# マスタ・管理テーブル定義書（韓国医療製品 受発注システム）

作成日：2026-11-24 ／ 状態：ドラフト（業務責任者の確認前）

## 0. 共通ルール

- 主キーは `id`（UUID）。業務上のコード（顧客コード等）は別項目で持ち、一意制約をかける。
- 全テーブルに `created_at` `updated_at` `created_by` `updated_by` を持たせる。
- 削除はせず `is_active`（有効フラグ）で無効化する。確定済みの取引は訂正履歴を残す。
- 金額は numeric で持つ。韓国ウォン（KRW）と円（JPY）は通貨コードを必ず併記する。
- 価格・単価は「その時点の値」を受注明細・発注明細に保存し、マスタ変更で過去金額が変わらないようにする。
- 全テーブルでRLSを有効化し、役割ごとに許可する。
- 「要確認」は業務責任者または専門家の判断が必要な項目。推測で確定しない。

### 全体の関係

```
顧客 ─┬─ 受注 ─── 受注明細 ─┬─ 製品 ─── 仕入先
      │                     ├─ 発注明細 ─── 発注
      │                     └─ 出荷明細 ─── 配送
      └─ 請求 ─── 入金
製品 ─── ロット ─── 納品先（トレーサビリティ）
発注 ─── 輸入申請
```

---

## 1. 顧客マスタ（customers）

**目的**：クリニックと配送先を管理する。1クリニックに複数の配送先があり得るため2テーブルに分ける。

### customers（クリニック）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 顧客コード | customer_code | text | ○ | 一意 |
| クリニック名 | clinic_name | text | ○ | |
| クリニック名（カナ） | clinic_name_kana | text | | 検索用 |
| 郵便番号・住所 | postal_code / address | text | ○ | 請求先住所 |
| 電話・FAX・メール | tel / fax / email | text | | |
| 締日 | closing_day | int | | 請求の締日 |
| 支払条件 | payment_terms | text | | 例：月末締め翌月末払い |
| 要確認：開設許可・免許情報 | license_info | text | | 取扱に必要な確認事項があるか |
| 備考 | note | text | | |
| 有効フラグ | is_active | bool | ○ | |

### customer_addresses（配送先）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 顧客ID | customer_id | FK | ○ | |
| 配送先名 | ship_to_name | text | ○ | 院名や分院名 |
| 郵便番号・住所 | postal_code / address | text | ○ | |
| 宛名（受取人） | recipient | text | | |
| 電話 | tel | text | ○ | 配送業者が使用 |
| 配送時の注意 | delivery_note | text | | 時間指定など |
| 既定フラグ | is_default | bool | | |

---

## 2. 製品マスタ（products）

**目的**：製品名、型番、素材、太さ、長さなどの仕様を管理する。

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 製品コード（SKU） | product_code | text | ○ | 一意 |
| 製品名 | product_name | text | ○ | |
| 製品名（韓国語・英語） | product_name_kr / product_name_en | text | | メーカー書類との照合用 |
| 型番 | model_no | text | ○ | メーカー型番 |
| 仕入先ID | supplier_id | FK | ○ | suppliers |
| カテゴリ | category | text | | |
| 素材 | material | text | | 例：PDO等 |
| 太さ | thickness | text | | 例：29G。単位を含めて持つ |
| 長さ | length_mm | numeric | | mm単位 |
| 入数・販売単位 | pack_qty / unit | int / text | ○ | 例：1箱10本 |
| ロット管理 | is_lot_managed | bool | ○ | 原則true |
| 使用期限管理 | is_expiry_managed | bool | ○ | 原則true |
| HSコード | hs_code | text | | 通関で使う品目コード。要確認：通関業者に確認 |
| 要確認：薬機法上の区分・承認／届出番号 | regulatory_info | text | | 日本での取扱要件を専門家に確認 |
| 保管条件 | storage_condition | text | | |
| 有効フラグ | is_active | bool | ○ | |

**制約**：`product_code` 一意。`supplier_id + model_no` も一意。

---

## 3. 仕入先マスタ（suppliers）

**目的**：韓国メーカーとその担当者・連絡先を管理する。

### suppliers

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 仕入先コード | supplier_code | text | ○ | 一意 |
| メーカー名 | supplier_name | text | ○ | |
| メーカー名（韓国語・英語） | supplier_name_kr / supplier_name_en | text | | |
| 国 | country | text | ○ | 既定：KR |
| 住所 | address | text | | |
| 取引通貨 | currency | text | ○ | 例：KRW / USD |
| 支払条件 | payment_terms | text | | 前払い等 |
| 使用言語 | language | text | | |
| 備考 | note | text | | |
| 有効フラグ | is_active | bool | ○ | |

### supplier_contacts（担当者）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 仕入先ID | supplier_id | FK | ○ | |
| 担当者名 | contact_name | text | ○ | |
| 部署・役職 | department / title | text | | |
| メール | email | text | | |
| 電話 | tel | text | | |
| メッセンジャーID | messenger_id | text | | KakaoTalk等 |
| 主担当フラグ | is_primary | bool | | |

---

## 4. 価格マスタ（prices）

**目的**：仕入価格、輸入代行価格、取引先別単価を管理する。有効期間つきで履歴を残し、上書きしない。

### supplier_prices（仕入価格）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 製品ID | product_id | FK | ○ | |
| 仕入単価 | unit_cost | numeric | ○ | |
| 通貨 | currency | text | ○ | KRW等 |
| 適用開始日・終了日 | valid_from / valid_to | date | ○ | 期間の重複は禁止 |

### import_fees（輸入代行価格）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 製品ID（空なら共通） | product_id | FK | | |
| 料金の種類 | fee_type | text | ○ | 定額／率／1件あたり など |
| 金額または率 | amount / rate | numeric | ○ | |
| 適用開始日・終了日 | valid_from / valid_to | date | ○ | |

### customer_prices（取引先別単価）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 顧客ID（空なら標準単価） | customer_id | FK | | |
| 製品ID | product_id | FK | ○ | |
| 販売単価（円） | unit_price | numeric | ○ | |
| 税区分 | tax_type | text | ○ | 要確認：課税区分と端数処理 |
| 適用開始日・終了日 | valid_from / valid_to | date | ○ | |

**ルール**：受注時の単価は、顧客別単価 → 標準単価の順で検索し、受注明細に確定単価として保存する。為替レートの扱い（毎回／月次固定）は要確認。

---

## 5. 受注管理（sales_orders）

**目的**：クリニックからの注文を管理する。

### sales_orders

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 受注番号 | order_no | text | ○ | 一意・自動採番 |
| 注文日 | order_date | date | ○ | |
| 顧客ID | customer_id | FK | ○ | |
| 配送先ID | ship_to_id | FK | ○ | |
| 希望納期 | requested_date | date | | |
| 状態 | status | text | ○ | 受付／発注済／入荷済／出荷済／完了／取消 |
| 合計金額 | total_amount | numeric | ○ | 明細から計算 |
| 備考 | note | text | | |

### sales_order_lines

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 受注ID | sales_order_id | FK | ○ | |
| 製品ID | product_id | FK | ○ | |
| 数量 | quantity | int | ○ | 1以上 |
| 確定単価 | unit_price | numeric | ○ | 受注時の単価を保存 |
| 状態 | line_status | text | ○ | |

**ルール**：分納を許容。取消は未出荷分のみ。確定後は削除せず訂正履歴を残す。

---

## 6. 発注管理（purchase_orders）

**目的**：韓国メーカーへの発注を管理する。

### purchase_orders

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 発注番号 | po_no | text | ○ | 一意 |
| 仕入先ID | supplier_id | FK | ○ | |
| メーカー発注日 | ordered_date | date | ○ | |
| 納期（回答） | promised_date | date | | メーカー回答納期 |
| 通貨・合計 | currency / total_amount | text / numeric | ○ | |
| 状態 | status | text | ○ | 下書き／発注済／一部入荷／入荷完了／取消 |
| 備考 | note | text | | |

### purchase_order_lines

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 発注ID | purchase_order_id | FK | ○ | |
| 製品ID | product_id | FK | ○ | |
| 数量 | quantity | int | ○ | |
| 仕入単価 | unit_cost | numeric | ○ | 発注時の単価を保存 |
| 受注明細ID | sales_order_line_id | FK | | どの受注のための発注か |
| 適用HSコード | applied_hs_code | text | | 通関時に適用したコード（製品マスタの値を初期表示） |
| 関税率 | duty_rate | numeric | | 通関時の税率 |
| 関税額 | duty_amount | numeric | | 品目別の関税額（原価按分用）。円 |
| 入庫日 | received_date | date | | |
| 検品担当者 | inspector_id | FK | | |
| 良品数 | good_qty | int | | |
| 不良数 | defect_qty | int | | |
| 破損数 | damaged_qty | int | | |
| クレーム対応状況 | claim_status | text | | なし／メーカーへ連絡／返金・交換待ち／完了 |
| クレーム内容 | claim_note | text | | |

**注意**：入庫・検品の項目は発注明細に1組だけ持つ。同じ明細が複数回に分けて入荷（部分入荷）する場合は、入庫日・数量を備考に追記するか、別途テーブルを分ける必要が出る（運用してから判断）。

**ルール**：発注は人が数量と仕入先を確認して確定する。入荷は発注明細に紐づけ、部分入荷を許容する。

---

## 7. 入金管理（invoices / payments）

**目的**：請求金額、入金日、未入金を管理する。

### invoices（請求）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 請求番号 | invoice_no | text | ○ | 一意 |
| 顧客ID | customer_id | FK | ○ | |
| 請求日・支払期限 | invoice_date / due_date | date | ○ | |
| 請求金額 | amount | numeric | ○ | |
| 状態 | status | text | ○ | 未請求／請求済／一部入金／入金済 |

### invoice_lines
請求に含む受注明細または出荷明細を紐づける（`invoice_id` `sales_order_line_id` `amount`）。

### payments（入金）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 請求ID | invoice_id | FK | ○ | |
| 入金日 | paid_date | date | ○ | |
| 入金額 | paid_amount | numeric | ○ | |
| 入金方法 | method | text | | 振込など |
| 振込手数料 | fee | numeric | | 差引の扱いは要確認 |

**ルール**：未入金額 ＝ 請求金額 − 入金合計（保存せず算出）。請求書の正式発行は経理の確認後。

---

## 8. 輸入申請管理（import_applications）

**目的**：輸入時の申請書類・申請日・確認状況を管理する。

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 申請番号 | application_no | text | ○ | |
| 発注ID | purchase_order_id | FK | ○ | |
| 申請種別 | application_type | text | ○ | 要確認：必要な申請の種類を専門家に確認 |
| 申請日 | applied_date | date | | |
| 確認状況 | status | text | ○ | 書類準備中／申請済／確認中／承認／差戻し |
| 確認完了日 | confirmed_date | date | | |
| 担当者 | assignee_id | FK | | |
| 備考 | note | text | | 差戻し理由など |
| 通関業者 | customs_broker | text | | |
| 輸入許可日 | import_permit_date | date | | |
| 申告番号 | declaration_no | text | | |
| 課税標準額 | taxable_value | numeric | | 円 |
| 関税 | duty_total | numeric | | 品目別関税額（発注明細）の合計と一致を確認 |
| 輸入消費税 | import_consumption_tax | numeric | | |
| 通関手数料 | customs_fee | numeric | | |
| その他費用（送料・保険等） | other_costs | numeric | | 原価按分の対象。要確認 |

### import_documents（申請書類）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 申請ID | application_id | FK | ○ | |
| 書類名 | document_name | text | ○ | インボイス、原産地証明など |
| ファイル | file_path | text | | Storageに保存。アクセス権を制限 |
| 提出日 | submitted_date | date | | |

**ルール**：必要書類が揃い、確認状況が「承認」になるまで、出荷確定をできないようにする案を検討（要確認）。

---

## 9. 配送管理（shipments）

**目的**：発送日、追跡番号、納品日を管理する。

### shipments

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 出荷番号 | shipment_no | text | ○ | 一意 |
| 区分 | direction | text | ○ | 国内配送（クリニックへ）／国際輸送（韓国から入荷） |
| 受注ID | sales_order_id | FK | △ | 国内配送のとき必須 |
| 配送先ID | ship_to_id | FK | △ | 国内配送のとき必須 |
| 発注ID | purchase_order_id | FK | △ | 国際輸送のとき必須 |
| 発送日 | shipped_date | date | | |
| 配送業者 | carrier | text | | DHL／FedEx／ヤマト等 |
| 追跡番号 | tracking_no | text | | |
| 納品日 | delivered_date | date | | 国際輸送では入荷日 |
| 状態 | status | text | ○ | 準備中／発送済／納品済／不達 |
| 輸送手段 | transport_mode | text | | 船便／航空便／国際宅配（国際輸送のみ） |
| B/L・AWB番号 | bl_awb_no | text | | 国際輸送のみ |
| 出発予定日（ETD） | etd | date | | 国際輸送のみ |
| 到着予定日（ETA） | eta | date | | 国際輸送のみ |

### shipment_lines

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 出荷ID | shipment_id | FK | ○ | |
| 受注明細ID | sales_order_line_id | FK | △ | 国内配送のとき必須 |
| 発注明細ID | purchase_order_line_id | FK | △ | 国際輸送のとき必須 |
| ロットID | lot_id | FK | | 国内配送のとき必須（どのロットを出したか） |
| 数量 | quantity | int | ○ | 国内配送は引当済み数量まで |

**ルール**：区分が国内配送のときは、受注・配送先・ロットの入力を必須にする。国際輸送のときは、発注と発注明細を必須にする。同じ出荷確定の二重送信で在庫が二重に減らないようにする。

---

## 10. 製品トレーサビリティ（lots / lot_movements）

**目的**：ロット番号、使用期限、納品先を記録し、問題発生時にどのクリニックへ納品したか追跡できるようにする。

### lots

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 製品ID | product_id | FK | ○ | |
| ロット番号 | lot_no | text | ○ | メーカーのロット番号 |
| 使用期限 | expiry_date | date | ○ | |
| 製造日 | manufactured_date | date | | |
| 発注明細ID | purchase_order_line_id | FK | | どの入荷で入ったか |
| 入荷数量 | received_qty | int | ○ | |
| 現在庫 | on_hand_qty | int | ○ | 履歴から整合させる |
| 状態 | status | text | ○ | 使用可／保留／回収 |

**制約**：`product_id + lot_no` 一意。

### lot_movements（ロットの動き）

| 項目 | 物理名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| ロットID | lot_id | FK | ○ | |
| 種別 | movement_type | text | ○ | 入荷／出荷／返品／廃棄／調整 |
| 数量 | quantity | int | ○ | 増減 |
| 元伝票 | source_type / source_id | text / UUID | ○ | 出荷明細など |
| 納品先 | customer_id / ship_to_id | FK | | 出荷時 |
| 操作者・日時 | created_by / created_at | | ○ | 改変不可 |

**ルール**：出荷は使用期限の近いロットから行う（先入先出）。ロット別に「納品先の一覧」を即座に出せること。回収時はロットで検索し、納品先と数量を一覧にする。保存期間は要確認。

---

## 11. 未決事項（業務責任者・専門家に確認）

1. 製品の薬機法上の区分と、日本での販売に必要な承認・届出・許可の有無。
2. 輸入申請の具体的な種類と必要書類（専門家の確認が必要）。
3. 輸入代行価格の計算方法（定額／率／件数）。
4. 為替レートの扱い（発注時／月次固定／入荷時）。
5. 消費税の区分、端数処理、請求書の様式。
6. クリニック側に求める確認事項（免許・開設情報など）。
7. ロット・納品記録の保存期間。
8. 関税・輸入消費税・通関手数料・送料を、品目へどう配分して原価にするか（金額比・数量比など。経理の方針）。
9. 部分入荷が多い場合に、入庫・検品を発注明細1組で足りるか（足りなければ入荷用のテーブルを分ける）。

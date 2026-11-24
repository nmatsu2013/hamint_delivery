# migration

データベースのスキーマ変更 SQL を配置します。

- [`create.sql`](./create.sql): `master-definitions.md` に基づく初期 PostgreSQL スキーマ
- [`0002_spec_detail.sql`](./0002_spec_detail.sql): 監査ログ、製品の拡張項目（`spec_note` / `usage` / `priority_class`）、監査トリガー
- [`0003_harden_audit_logs.sql`](./0003_harden_audit_logs.sql): 監査ログの UPDATE / DELETE / TRUNCATE 権限剥奪
- [`0004_remove_roles.sql`](./0004_remove_roles.sql): 権限管理廃止に伴う監査ログのロール列削除
- [`products-seed.sql`](./products-seed.sql): サンプルデータ（製品28件・顧客8件・受注30件・発注23件・輸入申請23件・配送27件・ロット19件・請求9件）

## 適用方法

```bash
npm run db:migrate            # migration/*.sql（seed除く）をファイル名順に適用
npm run db:seed               # products が空のときだけシードを投入
npm run db:seed -- --reset    # 既存サンプルデータを削除して30件シードを再投入
```

`create.sql` は `btree_gist` 拡張を利用します。全テーブルで RLS を有効にしていますが、ロールやアクセス範囲が未定義のためポリシーは含めていません。アプリケーション利用前に、運用環境に合わせた RLS ポリシーを追加してください。

`products-seed.sql` は `shipments.direction` と `lot_movements.movement_type` を CHECK 制約に合わせて英語コード（`international` / `domestic`、`receipt` / `shipment`）で投入します。API の日本語ラベルへの変換はアプリ側で行います。

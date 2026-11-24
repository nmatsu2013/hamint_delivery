# migration

データベースのスキーマ変更 SQL を配置します。

- [`create.sql`](./create.sql): `master-definitions.md` に基づく初期 PostgreSQL スキーマ
- [`0002_spec_detail.sql`](./0002_spec_detail.sql): 監査ログ、製品の拡張項目（`spec_note` / `usage` / `priority_class`）、監査トリガー
- [`products-seed.sql`](./products-seed.sql): サンプルデータ（製品28件・顧客5件・受注6件など）

## 適用方法

```bash
npm run db:migrate   # migration/*.sql（seed除く）をファイル名順に適用
npm run db:seed      # products が空のときだけシードを投入
```

`create.sql` は `btree_gist` 拡張を利用します。全テーブルで RLS を有効にしていますが、ロールやアクセス範囲が未定義のためポリシーは含めていません。アプリケーション利用前に、運用環境に合わせた RLS ポリシーを追加してください。

`products-seed.sql` は `shipments.direction` と `lot_movements.movement_type` を CHECK 制約に合わせて英語コード（`international` / `domestic`、`receipt` / `shipment`）で投入します。API の日本語ラベルへの変換はアプリ側で行います。

-- spec_detail.md 2.1 / 2.3 に基づく追加マイグレーション
-- ・products の拡張項目（規格メモ・用途・主力区分）
-- ・audit_logs と全業務テーブルの監査トリガー
BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS spec_note text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS priority_class text;

CREATE TABLE IF NOT EXISTS audit_logs (
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

CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx ON audit_logs (table_name, record_id);

-- 操作者情報はアプリケーションがトランザクション内で set_config する。
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_user uuid;
    v_role text;
BEGIN
    BEGIN
        v_user := nullif(current_setting('app.user_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
        v_user := NULL;
    END;
    v_role := nullif(current_setting('app.user_role', true), '');

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, user_id, user_role, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', v_user, v_role, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, user_id, user_role, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_user, v_role, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSE
        INSERT INTO audit_logs (table_name, record_id, action, user_id, user_role, old_data, new_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', v_user, v_role, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
END;
$$;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'customers',
        'customer_addresses',
        'suppliers',
        'supplier_contacts',
        'products',
        'supplier_prices',
        'import_fees',
        'customer_prices',
        'sales_orders',
        'sales_order_lines',
        'purchase_orders',
        'purchase_order_lines',
        'invoices',
        'invoice_lines',
        'payments',
        'import_applications',
        'import_documents',
        'shipments',
        'shipment_lines',
        'lots',
        'lot_movements'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', table_name || '_audit_row_change', table_name);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row_change()',
            table_name || '_audit_row_change',
            table_name
        );
    END LOOP;
END;
$$;

-- AT-28: 通常ユーザーは監査ログを改変・削除できない。
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
        GRANT SELECT, INSERT ON audit_logs TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON audit_logs FROM anon;
    END IF;
END;
$$;

COMMIT;

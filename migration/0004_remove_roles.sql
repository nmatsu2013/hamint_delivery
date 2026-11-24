-- 権限管理廃止: 監査ログからロール情報を削除する。
BEGIN;

CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_user uuid;
BEGIN
    BEGIN
        v_user := nullif(current_setting('app.user_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
        v_user := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, user_id, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', v_user, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, user_id, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_user, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSE
        INSERT INTO audit_logs (table_name, record_id, action, user_id, old_data, new_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', v_user, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
END;
$$;

ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_role;

COMMIT;

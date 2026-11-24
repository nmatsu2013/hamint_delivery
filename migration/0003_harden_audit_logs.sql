-- AT-28: 監査ログは通常ユーザーが改変・削除・全削除できないようにする。
-- Supabaseの既定権限には TRUNCATE / REFERENCES / TRIGGER が含まれるため、ALLを剥奪してから
-- 参照と追記のみを許可する。
BEGIN;

REVOKE ALL ON audit_logs FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON audit_logs FROM authenticated;
        GRANT SELECT, INSERT ON audit_logs TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON audit_logs FROM anon;
    END IF;
END;
$$;

COMMIT;

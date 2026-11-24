import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import type { Actor, Role } from '../types/api';
import { ErrorAlert } from '../components/elements/StateViews';

const ROLES: Array<{ role: Role; label: string; description: string }> = [
  { role: 'sales', label: '営業', description: '受注の登録・閲覧' },
  { role: 'purchasing', label: '購買', description: '発注・輸入・国際輸送' },
  { role: 'warehouse', label: '倉庫', description: '入庫・ロット・国内出荷' },
  { role: 'accounting', label: '経理', description: '請求・入金・金額確認' },
  { role: 'admin', label: '管理者', description: 'すべての操作・監査ログ' },
];

const DEV_AUTH = import.meta.env.VITE_DEV_AUTH
  ? import.meta.env.VITE_DEV_AUTH !== 'false'
  : import.meta.env.DEV;

export function LoginPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const actor = useAuthStore((state) => state.actor);
  const setSession = useAuthStore((state) => state.setSession);
  const setActor = useAuthStore((state) => state.setActor);
  const logout = useAuthStore((state) => state.logout);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [manualToken, setManualToken] = useState('');

  if (token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="eyebrow">HAMINT DELIVERY</div>
          <h1 className="login-title">ログイン済みです</h1>
          <p className="login-subtitle">
            {actor ? `${actor.name ?? actor.email}（${actor.roleLabel}）` : 'セッションが有効です'}
          </p>
          <div className="btn-row">
            <Link className="btn btn-primary" to="/orders">
              受注一覧へ
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                logout();
                setError(null);
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    );
  }

  const loginByRole = async (role: Role) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{
        token: string;
        actor: { email: string; role: Role; roleLabel: string };
      }>('/auth/dev-login', { role }, null);
      setSession(result.token, {
        email: result.actor.email,
        role: result.actor.role,
        roleLabel: result.actor.roleLabel,
        name: `${result.actor.roleLabel}担当`,
      });
      navigate('/orders', { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const loginByToken = async () => {
    if (!manualToken.trim()) {
      setError(new Error('トークンを入力してください'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setSession(manualToken.trim(), null);
      const me = await api.get<Actor>('/me');
      setActor(me);
      navigate('/orders', { replace: true });
    } catch (caught) {
      logout();
      setError(
        caught instanceof ApiError
          ? caught
          : new Error('トークンを検証できませんでした'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div>
          <div className="eyebrow">HAMINT DELIVERY</div>
          <h1 className="login-title">受発注管理</h1>
          <p className="login-subtitle">
            医療製品の受注から入金までを一元管理します。
          </p>
        </div>

        {DEV_AUTH ? (
          <div className="stack">
            <div className="section-title" style={{ fontSize: 18 }}>
              開発用ログイン（ロールを選択）
            </div>
            <div className="role-grid">
              {ROLES.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  className="role-button"
                  disabled={busy}
                  onClick={() => void loginByRole(item.role)}
                >
                  {item.label}
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
            <p className="field-hint">
              本番環境では Supabase Auth の JWT を利用し、この開発用ログインは無効化します。
            </p>
          </div>
        ) : null}

        <div className="stack">
          <div className="section-title" style={{ fontSize: 18 }}>
            {DEV_AUTH ? 'または JWT でログイン' : 'JWT でログイン'}
          </div>
          <div className="field">
            <label htmlFor="jwt">Supabase アクセストークン</label>
            <textarea
              id="jwt"
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
              placeholder="eyJhbGciOi..."
              style={{ minHeight: 72 }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !manualToken.trim()}
            onClick={() => void loginByToken()}
          >
            {busy ? '確認中…' : 'ログイン'}
          </button>
          {DEV_AUTH ? (
            <p className="field-hint">
              APIサーバーが起動していれば、上のロールボタンだけでログインできます。
            </p>
          ) : null}
        </div>

        {error ? <ErrorAlert error={error} /> : null}
      </div>
    </div>
  );
}

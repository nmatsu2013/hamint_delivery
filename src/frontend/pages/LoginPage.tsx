import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import type { Actor } from '../types/api';
import { ErrorAlert } from '../components/elements/StateViews';

export function LoginPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const actor = useAuthStore((state) => state.actor);
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="eyebrow">HAMINT DELIVERY</div>
          <h1 className="login-title">ログイン済みです</h1>
          <p className="login-subtitle">{actor?.name ?? actor?.userId ?? 'セッションが有効です'}</p>
          <div className="btn-row">
            <Link className="btn btn-primary" to="/orders">
              受注一覧へ
            </Link>
            <button type="button" className="btn btn-secondary" onClick={logout}>
              ログアウト
            </button>
          </div>
        </div>
      </div>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ token: string; actor: Actor }>(
        '/auth/login',
        { userId, password },
        null,
      );
      setSession(result.token, result.actor);
      navigate('/orders', { replace: true });
    } catch (caught) {
      setError(caught);
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
          <p className="login-subtitle">ユーザーIDとパスワードを入力してください。</p>
        </div>

        <form className="stack" onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label htmlFor="userId">ユーザーID</label>
            <input
              id="userId"
              name="userId"
              type="text"
              autoComplete="username"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">パスワード</label>
            <div className="password-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                aria-pressed={showPassword}
              >
                {showPassword ? '隠す' : '表示'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !userId || !password}
          >
            {busy ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        {error ? <ErrorAlert error={error} /> : null}
      </div>
    </div>
  );
}

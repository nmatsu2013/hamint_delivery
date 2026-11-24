import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const NAV_ITEMS = [
  { to: '/orders', label: '受注一覧' },
  { to: '/purchase-orders', label: '発注' },
  { to: '/imports', label: '輸入・配送' },
  { to: '/warehouse', label: '入庫・出荷' },
  { to: '/billing', label: '請求・入金' },
  { to: '/traceability', label: 'ロット' },
  { to: '/master', label: '顧客・製品' },
];

export function Header() {
  const actor = useAuthStore((state) => state.actor);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-header">
      <span className="brand">受発注管理</span>
      <nav className="app-nav" aria-label="メインメニュー">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <NavLink to="/orders/new" className="header-action">
        ＋ 新規受注
      </NavLink>
      <div className="header-user">
        <span>{actor?.name ?? actor?.userId ?? ''}</span>
        <button type="button" className="header-ghost" onClick={handleLogout}>
          ログアウト
        </button>
      </div>
    </header>
  );
}

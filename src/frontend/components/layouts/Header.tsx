import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { Role } from '../../types/api';

const ALL: Role[] = ['sales', 'purchasing', 'warehouse', 'accounting', 'admin'];

interface NavItem {
  to: string;
  label: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/orders', label: '受注一覧', roles: ALL },
  {
    to: '/purchase-orders',
    label: '発注一覧',
    roles: ['purchasing', 'warehouse', 'accounting', 'admin'],
  },
  { to: '/imports', label: '輸入・配送', roles: ['purchasing', 'warehouse', 'accounting', 'admin'] },
  { to: '/warehouse', label: '入庫・ロット', roles: ['warehouse', 'admin'] },
  {
    to: '/shipments',
    label: '出荷・配送',
    roles: ['purchasing', 'warehouse', 'accounting', 'admin'],
  },
  { to: '/billing', label: '請求・入金', roles: ['accounting', 'admin'] },
  { to: '/traceability', label: 'ロット追跡', roles: ['warehouse', 'accounting', 'admin'] },
  { to: '/master', label: '顧客・製品', roles: ALL },
];

export function Header() {
  const actor = useAuthStore((state) => state.actor);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const role = actor?.role;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-header">
      <span className="brand">受発注管理</span>
      <nav className="app-nav" aria-label="メインメニュー">
        {NAV_ITEMS.filter((item) => (role ? item.roles.includes(role) : false)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {(role === 'sales' || role === 'admin') && (
        <NavLink to="/orders/new" className="header-action">
          ＋ 新規受注
        </NavLink>
      )}
      <div className="header-user">
        <span>
          {actor?.name ?? actor?.email ?? ''}
          {actor ? `（${actor.roleLabel}）` : ''}
        </span>
        <button type="button" className="header-ghost" onClick={handleLogout}>
          ログアウト
        </button>
      </div>
    </header>
  );
}

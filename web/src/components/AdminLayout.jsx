import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">FastMark Admin</div>
        <nav>
          <NavLink to="/" end>
            Duyệt người bán
          </NavLink>
          <NavLink to="/categories">
            Quản lý danh mục
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="admin-email">{user?.email}</div>
          <button type="button" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

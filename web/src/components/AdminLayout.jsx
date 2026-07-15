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
            Dashboard
          </NavLink>
          <NavLink to="/verifications">
            Duyệt người bán
          </NavLink>
          <NavLink to="/accounts">
            Quản lý người dùng
          </NavLink>
          <NavLink to="/reports">
            Quản lý báo cáo vi phạm
          </NavLink>
          <NavLink to="/reviews">
            Quản lý đánh giá
          </NavLink>
          <NavLink to="/notifications">
            Gửi thông báo hệ thống
          </NavLink>
          <NavLink to="/categories">
            Quản lý danh mục SP/CH
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

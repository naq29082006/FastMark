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
          <NavLink to="/accounts">Người dùng</NavLink>
          <NavLink to="/verifications">Duyệt người bán</NavLink>
          <NavLink to="/shops">Gian hàng</NavLink>
          <NavLink to="/products">Sản phẩm</NavLink>
          <NavLink to="/categories">Danh mục</NavLink>
          <NavLink to="/reservations">Đơn giữ hàng</NavLink>
          <NavLink to="/reports">Báo cáo & Khiếu nại</NavLink>
          <NavLink to="/reviews">Đánh giá</NavLink>
          <NavLink to="/notifications">Thông báo</NavLink>
          <NavLink to="/banners">Banner</NavLink>
          <NavLink to="/stats">Thống kê</NavLink>
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

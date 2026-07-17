import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listAccounts } from '../api/accountApi';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '1', label: 'Người mua' },
  { value: '2', label: 'Người bán' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Hoạt động' },
  { value: '0', label: 'Đã khóa' },
];

const VERIFICATION_OPTIONS = [
  { value: '', label: 'Tất cả xác minh' },
  { value: '0', label: 'Chờ duyệt' },
  { value: '1', label: 'Đã duyệt' },
  { value: '2', label: 'Đã từ chối' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'last_active', label: 'Hoạt động gần nhất' },
  { value: 'most_products', label: 'Nhiều sản phẩm nhất' },
];

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('vi-VN');
}

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
}

function verificationBadgeClass(status) {
  if (status === 0) return 'badge badge-warning';
  if (status === 1) return 'badge badge-info';
  if (status === 2) return 'badge badge-danger';
  return 'badge';
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index}>
          <td><div className="skeleton skeleton-avatar" /></td>
          <td><div className="skeleton skeleton-line" /></td>
          <td><div className="skeleton skeleton-line" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
        </tr>
      ))}
    </>
  );
}

export default function AccountsPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await listAccounts(token, {
        search,
        role,
        status,
        verificationStatus,
        sort,
        page,
        limit: 20,
      });

      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách người dùng.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, page, role, search, sort, status, verificationStatus]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleFilterChange(setter, value) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Người dùng</h1>
          <p>Quản lý tài khoản người mua và người bán. Tài khoản quản trị không hiển thị ở đây.</p>
        </div>
        <button type="button" onClick={loadItems} disabled={loading}>
          Làm mới
        </button>
      </header>

      <section className="filter-card">
        <form className="filter-form" onSubmit={handleSearchSubmit}>
          <label className="filter-search">
            Tìm kiếm
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên đăng nhập, họ tên, email, SĐT, tên cửa hàng..."
            />
          </label>
          <button type="submit" className="primary-btn">Tìm</button>
        </form>

        <div className="filter-grid">
          <label>
            Vai trò
            <select value={role} onChange={(event) => handleFilterChange(setRole, event.target.value)}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value || 'all-role'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Trạng thái
            <select value={status} onChange={(event) => handleFilterChange(setStatus, event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all-status'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Xác minh người bán
            <select
              value={verificationStatus}
              onChange={(event) => handleFilterChange(setVerificationStatus, event.target.value)}
            >
              {VERIFICATION_OPTIONS.map((option) => (
                <option key={option.value || 'all-verification'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sắp xếp
            <select value={sort} onChange={(event) => handleFilterChange(setSort, event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="account-table-wrap">
        <table className="account-table">
          <thead>
            <tr>
              <th>Ảnh đại diện</th>
              <th>Tài khoản</th>
              <th>Liên hệ</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Cửa hàng</th>
              <th>Hoạt động</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows /> : null}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-card">Không tìm thấy người dùng phù hợp.</div>
                </td>
              </tr>
            ) : null}
            {!loading
              ? items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.avatar ? (
                        <img src={item.avatar} alt="" className="account-avatar" />
                      ) : (
                        <div className="account-avatar placeholder">{item.userName?.charAt(0) || 'U'}</div>
                      )}
                    </td>
                    <td>
                      <div className="account-primary">{item.fullName || '—'}</div>
                      <div className="account-secondary">@{item.userName}</div>
                      <div className="account-secondary mono">{item.userId}</div>
                    </td>
                    <td>
                      <div>{item.email || '—'}</div>
                      <div className="account-secondary">{item.phone || '—'}</div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{item.roleLabel}</span>
                    </td>
                    <td>
                      <span className={statusBadgeClass(item.status)} title="Trạng thái tài khoản">
                        {item.statusLabel}
                      </span>
                    </td>
                    <td>
                      {item.shop ? (
                        <>
                          <div>{item.shop.shopName}</div>
                          <div className="account-secondary">
                            <span className={statusBadgeClass(item.shop.status)}>{item.shop.statusLabel}</span>
                            {item.verification ? (
                              <span
                                className={verificationBadgeClass(item.verification.status)}
                                title="Trạng thái xác minh"
                              >
                                {item.verification.statusLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="account-secondary">
                            {item.productCount} sản phẩm • ★ {item.averageRating?.toFixed?.(1) || '0.0'}
                          </div>
                        </>
                      ) : (
                        <span className="account-secondary">—</span>
                      )}
                    </td>
                    <td>
                      <div className="account-secondary">Tạo: {formatDate(item.createdAt)}</div>
                      <div className="account-secondary">Gần nhất: {formatDate(item.lastActiveAt)}</div>
                    </td>
                    <td>
                      <Link to={`/accounts/${item.id}`} className="table-link">
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <span>
          Trang {pagination.page}/{pagination.totalPages} • {pagination.total} người dùng
        </span>
        <div className="pagination-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Trước
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}

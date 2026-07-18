import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { blockShop, deleteShop, listShops, unblockShop } from '../api/catalogApi';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Hoạt động' },
  { value: '0', label: 'Đã khóa' },
];

const OPEN_OPTIONS = [
  { value: '', label: 'Tất cả mở/đóng' },
  { value: '1', label: 'Đang mở' },
  { value: '0', label: 'Đóng cửa' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

export default function ShopsPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [isOpen, setIsOpen] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listShops(token, { search, status, isOpen, page, limit: 20 });
      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách gian hàng.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, isOpen, page, search, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function runAction(shopId, action) {
    setBusyId(shopId);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      if (action === 'block') await blockShop(token, shopId);
      if (action === 'unblock') await unblockShop(token, shopId);
      if (action === 'delete') {
        const confirmed = window.confirm('Xóa/đóng gian hàng này và ẩn toàn bộ sản phẩm?');
        if (!confirmed) return;
        await deleteShop(token, shopId);
      }
      setMessage('Cập nhật gian hàng thành công.');
      await loadItems();
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Gian hàng</h1>
          <p>Quản lý danh sách gian hàng, khóa/mở khóa và xem chi tiết.</p>
        </div>
        <button type="button" onClick={loadItems} disabled={loading}>
          Làm mới
        </button>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <p className="success-banner">{message}</p> : null}

      <section className="filter-card">
        <form
          className="filter-form"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <label className="filter-search">
            Tìm kiếm
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên shop, username, địa chỉ, SĐT..."
            />
          </label>
          <button type="submit" className="primary-btn">
            Tìm
          </button>
        </form>

        <div className="filter-grid">
          <label>
            Trạng thái hoạt động
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all-status'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái mở/đóng
            <select
              value={isOpen}
              onChange={(event) => {
                setIsOpen(event.target.value);
                setPage(1);
              }}
            >
              {OPEN_OPTIONS.map((option) => (
                <option key={option.value || 'all-open'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Gian hàng</th>
              <th>Chủ shop</th>
              <th>Địa chỉ</th>
              <th>Danh mục</th>
              <th>Mở/đóng</th>
              <th>Gói</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>Đang tải...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8}>Không có gian hàng.</td>
              </tr>
            ) : (
              items.map((shop) => (
                <tr key={shop.id}>
                  <td>
                    <div className="user-cell">
                      {shop.avatar ? (
                        <img src={shop.avatar} alt="" className="avatar-sm" />
                      ) : (
                        <div className="avatar-sm avatar-fallback">
                          {(shop.shopName || 'S').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <strong>{shop.shopName || '—'}</strong>
                        <div className="muted">@{shop.shopUsername || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {shop.owner?.fullName || '—'}
                    <div className="muted">{shop.owner?.email || ''}</div>
                  </td>
                  <td>{shop.address || '—'}</td>
                  <td>{shop.categoryName || '—'}</td>
                  <td>
                    <span className={shop.isOpen === 1 ? 'badge badge-success' : 'badge'}>
                      {shop.isOpenLabel}
                    </span>
                  </td>
                  <td>
                    {shop.subscriptionActive ? (
                      <span className="badge badge-success">
                        {shop.subscriptionPlan ? `${shop.subscriptionPlan} tháng` : 'Active'}
                        <div className="muted">{formatDate(shop.subscriptionExpiresAt)}</div>
                      </span>
                    ) : (
                      <span className="badge">Hết / chưa mua</span>
                    )}
                  </td>
                  <td>
                    <span className={shop.status === 1 ? 'badge badge-success' : 'badge badge-danger'}>
                      {shop.statusLabel}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      <Link className="link-btn" to={`/shops/${shop.id}`}>
                        Chi tiết
                      </Link>
                      {shop.status === 1 ? (
                        <button
                          type="button"
                          disabled={busyId === shop.id}
                          onClick={() => runAction(shop.id, 'block')}
                        >
                          Khóa
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === shop.id}
                          onClick={() => runAction(shop.id, 'unblock')}
                        >
                          Mở khóa
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={busyId === shop.id}
                        onClick={() => runAction(shop.id, 'delete')}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="pagination-row">
          <span>
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} gian hàng
          </span>
          <div className="action-row">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Trước
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

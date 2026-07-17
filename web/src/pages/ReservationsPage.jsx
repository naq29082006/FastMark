import { useCallback, useEffect, useState } from 'react';

import {
  cancelReservation,
  getReservationDetail,
  listReservations,
} from '../api/catalogApi';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '0', label: 'Chờ xác nhận' },
  { value: '1', label: 'Đã xác nhận' },
  { value: '2', label: 'Đã nhận hàng' },
  { value: '3', label: 'Đã hủy' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function ReservationsPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [selected, setSelected] = useState(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listReservations(token, { search, status, page, limit: 20 });
      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách đơn giữ hàng.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, page, search, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function openDetail(id) {
    try {
      const token = await getIdToken();
      const payload = await getReservationDetail(token, id);
      setSelected(payload.data?.reservation || null);
    } catch (detailError) {
      setError(detailError.message || 'Không tải được chi tiết đơn.');
    }
  }

  async function handleCancel(id) {
    const reason = window.prompt('Lý do hủy đơn (admin):', 'Admin hủy đơn.');
    if (reason === null) return;
    setBusyId(id);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      await cancelReservation(token, id, reason);
      setMessage('Đã hủy đơn giữ hàng.');
      setSelected(null);
      await loadItems();
    } catch (actionError) {
      setError(actionError.message || 'Không hủy được đơn.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Đơn giữ hàng</h1>
          <p>Theo dõi toàn bộ đơn giữ hàng trên hệ thống.</p>
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
            Tra cứu
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Mã đơn, khách hàng, gian hàng, sản phẩm..."
            />
          </label>
          <button type="submit" className="primary-btn">
            Tìm
          </button>
        </form>
        <div className="filter-grid">
          <label>
            Trạng thái
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
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
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Gian hàng</th>
              <th>Sản phẩm</th>
              <th>SL</th>
              <th>Thời gian nhận</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8}>Không có đơn giữ hàng.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.code}</strong></td>
                  <td>{item.buyer?.fullName || '—'}</td>
                  <td>{item.shop?.shopName || '—'}</td>
                  <td>{item.product?.productName || '—'}</td>
                  <td>{item.quantity}</td>
                  <td>{formatDate(item.pickupTime)}</td>
                  <td>
                    <span className="badge">{item.statusLabel}</span>
                  </td>
                  <td>
                    <div className="action-row">
                      <button type="button" onClick={() => openDetail(item.id)}>
                        Chi tiết
                      </button>
                      {item.status !== 2 && item.status !== 3 ? (
                        <button
                          type="button"
                          className="danger-btn"
                          disabled={busyId === item.id}
                          onClick={() => handleCancel(item.id)}
                        >
                          Hủy
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="pagination-row">
          <span>
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} đơn
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

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="page-header">
              <div>
                <h2>Đơn {selected.code}</h2>
                <p>{selected.statusLabel}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </header>
            <dl className="detail-list">
              <div><dt>Khách hàng</dt><dd>{selected.buyer?.fullName || '—'}</dd></div>
              <div><dt>Gian hàng</dt><dd>{selected.shop?.shopName || '—'}</dd></div>
              <div><dt>Sản phẩm</dt><dd>{selected.product?.productName || '—'}</dd></div>
              <div><dt>Phân loại</dt><dd>{selected.variant?.variantName || '—'}</dd></div>
              <div><dt>Số lượng</dt><dd>{selected.quantity}</dd></div>
              <div><dt>Giá giữ</dt><dd>{formatPrice(selected.reservedPrice)}</dd></div>
              <div><dt>Giá chốt</dt><dd>{formatPrice(selected.agreedPrice)}</dd></div>
              <div><dt>Nhận lúc</dt><dd>{formatDate(selected.pickupTime)}</dd></div>
              <div><dt>Ghi chú</dt><dd>{selected.note || '—'}</dd></div>
              <div><dt>Lý do hủy</dt><dd>{selected.cancelReason || '—'}</dd></div>
              <div><dt>Tạo lúc</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}

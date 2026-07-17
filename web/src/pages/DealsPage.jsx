import { useCallback, useEffect, useState } from 'react';

import { getDealDetail, listDeals, lockDeal } from '../api/catalogApi';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '0', label: 'Đang thương lượng' },
  { value: '1', label: 'Đã chấp nhận' },
  { value: '2', label: 'Đã từ chối / khóa' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function DealsPage() {
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
      const payload = await listDeals(token, { search, status, page, limit: 20 });
      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách deal.');
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
      const payload = await getDealDetail(token, id);
      setSelected(payload.data?.deal || null);
    } catch (detailError) {
      setError(detailError.message || 'Không tải được chi tiết deal.');
    }
  }

  async function handleLock(id) {
    const reason = window.prompt('Lý do khóa deal bất thường:', 'Admin khóa deal bất thường.');
    if (reason === null) return;
    setBusyId(id);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      await lockDeal(token, id, reason);
      setMessage('Đã khóa deal.');
      setSelected(null);
      await loadItems();
    } catch (actionError) {
      setError(actionError.message || 'Không khóa được deal.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Deal giá</h1>
          <p>Theo dõi thương lượng giá giữa người mua và gian hàng.</p>
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
              placeholder="Người mua, shop, sản phẩm..."
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
              <th>Người mua</th>
              <th>Người bán / Shop</th>
              <th>Giá gốc</th>
              <th>Giá đề nghị</th>
              <th>Bên đề nghị</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7}>Không có deal.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.buyer?.fullName || '—'}</td>
                  <td>
                    {item.seller?.fullName || '—'}
                    <div className="muted">{item.shop?.shopName || ''}</div>
                  </td>
                  <td>{formatPrice(item.originalPrice)}</td>
                  <td>{formatPrice(item.offeredPrice)}</td>
                  <td>{item.lastOfferByLabel}</td>
                  <td>
                    <span className="badge">{item.statusLabel}</span>
                  </td>
                  <td>
                    <div className="action-row">
                      <button type="button" onClick={() => openDetail(item.id)}>
                        Lịch sử
                      </button>
                      {item.status === 0 ? (
                        <button
                          type="button"
                          className="danger-btn"
                          disabled={busyId === item.id}
                          onClick={() => handleLock(item.id)}
                        >
                          Khóa deal
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
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} deal
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
                <h2>Chi tiết deal</h2>
                <p>{selected.statusLabel}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </header>
            <dl className="detail-list">
              <div><dt>Người mua</dt><dd>{selected.buyer?.fullName || '—'}</dd></div>
              <div><dt>Người bán</dt><dd>{selected.seller?.fullName || '—'}</dd></div>
              <div><dt>Shop</dt><dd>{selected.shop?.shopName || '—'}</dd></div>
              <div><dt>Sản phẩm</dt><dd>{selected.product?.productName || '—'}</dd></div>
              <div><dt>Phân loại</dt><dd>{selected.variant?.variantName || '—'}</dd></div>
              <div><dt>Giá gốc</dt><dd>{formatPrice(selected.originalPrice)}</dd></div>
              <div><dt>Giá đề nghị / phản hồi</dt><dd>{formatPrice(selected.offeredPrice)}</dd></div>
              <div><dt>Bên đề nghị cuối</dt><dd>{selected.lastOfferByLabel}</dd></div>
              <div><dt>Số lượng</dt><dd>{selected.quantity}</dd></div>
              <div><dt>Ghi chú buyer</dt><dd>{selected.note || '—'}</dd></div>
              <div><dt>Ghi chú shop/admin</dt><dd>{selected.sellerNote || '—'}</dd></div>
              <div><dt>Tạo lúc</dt><dd>{formatDate(selected.createdAt)}</dd></div>
              <div><dt>Phản hồi lúc</dt><dd>{formatDate(selected.respondedAt)}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';

import {
  deleteProduct,
  getProductDetail,
  hideProduct,
  listProducts,
  showProduct,
} from '../api/catalogApi';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Đang hiện' },
  { value: '0', label: 'Đã ẩn' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

export default function ProductsPage() {
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
      const payload = await listProducts(token, { search, status, page, limit: 20 });
      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách sản phẩm.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, page, search, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function runAction(productId, action) {
    setBusyId(productId);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      if (action === 'hide') await hideProduct(token, productId);
      if (action === 'show') await showProduct(token, productId);
      if (action === 'delete') {
        const confirmed = window.confirm('Ẩn/xóa sản phẩm này?');
        if (!confirmed) return;
        await deleteProduct(token, productId);
      }
      setMessage('Cập nhật sản phẩm thành công.');
      await loadItems();
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setBusyId('');
    }
  }

  async function openDetail(productId) {
    try {
      const token = await getIdToken();
      const payload = await getProductDetail(token, productId);
      setSelected(payload.data?.product || null);
    } catch (detailError) {
      setError(detailError.message || 'Không tải được chi tiết sản phẩm.');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Sản phẩm</h1>
          <p>Quản lý sản phẩm toàn hệ thống: xem, ẩn, hiện, xóa.</p>
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
              placeholder="Tên sản phẩm, mô tả..."
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
              <th>Ảnh</th>
              <th>Tên sản phẩm</th>
              <th>Giá</th>
              <th>Gian hàng</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}>Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6}>Không có sản phẩm.</td></tr>
            ) : (
              items.map((product) => (
                <tr key={product.id}>
                  <td>
                    {product.thumbnail ? (
                      <img src={product.thumbnail} alt="" className="thumb-sm" />
                    ) : (
                      <div className="thumb-sm thumb-fallback">SP</div>
                    )}
                  </td>
                  <td>
                    <strong>{product.productName}</strong>
                    <div className="muted">{product.categoryName || '—'}</div>
                  </td>
                  <td>{product.priceLabel}</td>
                  <td>{product.shopName || '—'}</td>
                  <td>
                    <span className={product.status === 1 ? 'badge badge-success' : 'badge'}>
                      {product.status === 1 ? 'Đang hiện' : 'Đã ẩn'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      <button type="button" onClick={() => openDetail(product.id)}>
                        Xem
                      </button>
                      {product.status === 1 ? (
                        <button
                          type="button"
                          disabled={busyId === product.id}
                          onClick={() => runAction(product.id, 'hide')}
                        >
                          Ẩn
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === product.id}
                          onClick={() => runAction(product.id, 'show')}
                        >
                          Hiện
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={busyId === product.id}
                        onClick={() => runAction(product.id, 'delete')}
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
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} sản phẩm
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
                <h2>{selected.productName}</h2>
                <p>{selected.shopName} · {selected.categoryName || '—'}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </header>
            <dl className="detail-list">
              <div><dt>Trạng thái</dt><dd>{selected.status === 1 ? 'Đang hiện' : 'Đã ẩn'}</dd></div>
              <div><dt>Đơn vị</dt><dd>{selected.donVi || '—'}</dd></div>
              <div><dt>Lượt xem</dt><dd>{selected.viewCount}</dd></div>
              <div><dt>Lượt thích</dt><dd>{selected.likeCount}</dd></div>
              <div><dt>Đã bán</dt><dd>{selected.soldCount}</dd></div>
              <div><dt>Ngày tạo</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            </dl>
            <p>{selected.description || 'Chưa có mô tả.'}</p>
            <h3>Phân loại</h3>
            <ul className="report-list">
              {(selected.variants || []).map((variant) => (
                <li key={variant.id} className="report-item">
                  <strong>{variant.variantName}</strong>
                  <p>
                    {Number(variant.price || 0).toLocaleString('vi-VN')}đ · Tồn {variant.quantity} ·
                    Đã bán {variant.soldCount}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

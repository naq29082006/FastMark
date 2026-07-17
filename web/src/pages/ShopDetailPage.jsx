import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { blockShop, getShopDetail, unblockShop } from '../api/catalogApi';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function ShopDetailPage() {
  const { shopId } = useParams();
  const { getIdToken } = useAuth();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getShopDetail(token, shopId);
      setShop(payload.data?.shop || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết gian hàng.');
      setShop(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, shopId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function toggleLock() {
    if (!shop) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      const payload =
        shop.status === 1 ? await blockShop(token, shop.id) : await unblockShop(token, shop.id);
      setShop(payload.data?.shop || shop);
      setMessage(shop.status === 1 ? 'Đã khóa gian hàng.' : 'Đã mở khóa gian hàng.');
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="loading-screen">Đang tải chi tiết gian hàng...</div>;
  }

  if (!shop) {
    return (
      <div className="page">
        <p className="error-banner">{error || 'Không tìm thấy gian hàng.'}</p>
        <Link to="/shops">← Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/shops" className="muted">
            ← Gian hàng
          </Link>
          <h1>{shop.shopName || 'Chi tiết gian hàng'}</h1>
          <p>@{shop.shopUsername || '—'} · {shop.categoryName || 'Chưa có danh mục'}</p>
        </div>
        <button type="button" onClick={toggleLock} disabled={busy}>
          {shop.status === 1 ? 'Khóa gian hàng' : 'Mở khóa gian hàng'}
        </button>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <p className="success-banner">{message}</p> : null}

      <section className="detail-grid">
        <article className="detail-card">
          <h3>Thông tin cửa hàng</h3>
          <dl className="detail-list">
            <div><dt>Trạng thái</dt><dd>{shop.statusLabel}</dd></div>
            <div><dt>Mở/đóng</dt><dd>{shop.isOpenLabel}</dd></div>
            <div><dt>Địa chỉ</dt><dd>{shop.address || '—'}</dd></div>
            <div><dt>SĐT</dt><dd>{shop.phone || '—'}</dd></div>
            <div><dt>Giờ mở</dt><dd>{shop.openTime || '—'} - {shop.closeTime || '—'}</dd></div>
            <div><dt>Rating</dt><dd>{shop.averageRating} ★ ({shop.totalReviews} đánh giá)</dd></div>
            <div><dt>Followers</dt><dd>{shop.followersCount}</dd></div>
            <div><dt>Đã bán</dt><dd>{shop.soldCount}</dd></div>
            <div><dt>Ngày tạo</dt><dd>{formatDate(shop.createdAt)}</dd></div>
          </dl>
          <p>{shop.description || 'Chưa có mô tả.'}</p>
        </article>

        <article className="detail-card">
          <h3>Chủ gian hàng</h3>
          {shop.owner ? (
            <dl className="detail-list">
              <div><dt>Họ tên</dt><dd>{shop.owner.fullName}</dd></div>
              <div><dt>Username</dt><dd>@{shop.owner.userName}</dd></div>
              <div><dt>Email</dt><dd>{shop.owner.email || '—'}</dd></div>
              <div><dt>SĐT</dt><dd>{shop.owner.phone || '—'}</dd></div>
              <div>
                <dt>Tài khoản</dt>
                <dd>
                  <Link to={`/accounts/${shop.owner.id}`}>Xem tài khoản</Link>
                </dd>
              </div>
            </dl>
          ) : (
            <p>Không có thông tin chủ shop.</p>
          )}
        </article>
      </section>

      <section className="table-card">
        <h3>Sản phẩm ({shop.products?.length || 0})</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Giá</th>
              <th>Trạng thái</th>
              <th>Đã bán</th>
            </tr>
          </thead>
          <tbody>
            {(shop.products || []).length === 0 ? (
              <tr><td colSpan={4}>Chưa có sản phẩm.</td></tr>
            ) : (
              shop.products.map((product) => (
                <tr key={product.id}>
                  <td>{product.productName}</td>
                  <td>
                    {product.minPrice === product.maxPrice
                      ? formatPrice(product.minPrice)
                      : `${formatPrice(product.minPrice)} - ${formatPrice(product.maxPrice)}`}
                  </td>
                  <td>{product.status === 1 ? 'Đang hiện' : 'Đã ẩn'}</td>
                  <td>{product.soldCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="detail-grid">
        <article className="detail-card">
          <h3>Lịch sử giữ hàng</h3>
          {(shop.reservations || []).length === 0 ? (
            <p>Chưa có đơn.</p>
          ) : (
            <ul className="report-list">
              {shop.reservations.map((item) => (
                <li key={item.id} className="report-item">
                  <strong>{item.statusLabel}</strong>
                  <p>SL: {item.quantity} · {formatDate(item.pickupTime || item.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="detail-card">
          <h3>Đánh giá khách hàng</h3>
          {(shop.reviews || []).length === 0 ? (
            <p>Chưa có đánh giá.</p>
          ) : (
            <ul className="report-list">
              {shop.reviews.map((item) => (
                <li key={item.id} className="report-item">
                  <strong>{item.userName} · {item.rating}★</strong>
                  <p>{item.comment || '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="detail-card">
          <h3>Lịch sử báo cáo</h3>
          {(shop.reports || []).length === 0 ? (
            <p>Chưa có báo cáo.</p>
          ) : (
            <ul className="report-list">
              {shop.reports.map((item) => (
                <li key={item.id} className="report-item">
                  <strong>{item.title || 'Báo cáo'}</strong>
                  <p>{formatDate(item.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}

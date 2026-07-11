import { useCallback, useEffect, useState } from 'react';

import {
  deleteAdminReview,
  hideAdminReview,
  listAdminReviews,
  showAdminReview,
} from '../api/adminReviewApi';
import { useAuth } from '../context/AuthContext';

const RATING_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '5', label: '5 sao' },
  { value: '4', label: '4 sao' },
  { value: '3', label: '3 sao' },
  { value: '2', label: '2 sao' },
  { value: '1', label: '1 sao' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'visible', label: 'Đang hiển thị' },
  { value: 'hidden', label: 'Đã ẩn' },
];

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('vi-VN');
}

function StarRating({ rating }) {
  const normalized = Math.max(0, Math.min(5, Number(rating) || 0));

  return (
    <div className="review-stars" aria-label={`${normalized} trên 5 sao`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starNumber = index + 1;
        const isActive = starNumber <= normalized;
        return (
          <span key={starNumber} className={isActive ? 'review-star review-star-active' : 'review-star'}>
            {isActive ? '★' : '☆'}
          </span>
        );
      })}
    </div>
  );
}

function DeleteConfirmDialog({ review, loading, onCancel, onConfirm }) {
  if (!review) {
    return null;
  }

  return (
    <div className="dialog-overlay" role="presentation" onClick={() => !loading && onCancel()}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Xóa đánh giá?</h3>
        <p>
          Bạn có chắc muốn xóa mềm đánh giá của{' '}
          <strong>{review.reviewer.fullName || review.reviewer.userName}</strong> cho sản phẩm{' '}
          <strong>{review.productName}</strong>? Đánh giá sẽ bị ẩn và loại khỏi danh sách quản trị.
        </p>
        <div className="dialog-actions">
          <button type="button" className="ghost-btn" disabled={loading} onClick={onCancel}>
            Hủy
          </button>
          <button type="button" className="danger-btn" disabled={loading} onClick={onConfirm}>
            {loading ? 'Đang xóa...' : 'Xóa đánh giá'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewManagement() {
  const { getIdToken } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await listAdminReviews(token, {
        search,
        rating: ratingFilter,
        status: statusFilter,
        page,
        limit: 20,
      });

      setReviews(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách đánh giá.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, page, ratingFilter, search, statusFilter]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timer = window.setTimeout(() => setSnackbar(''), 3200);
    return () => window.clearTimeout(timer);
  }, [snackbar]);

  function showMessage(message) {
    setSnackbar(message);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleRatingChange(event) {
    setPage(1);
    setRatingFilter(event.target.value);
  }

  function handleStatusChange(event) {
    setPage(1);
    setStatusFilter(event.target.value);
  }

  async function handleToggleHidden(review) {
    setActionLoadingId(review.id);
    setError('');

    try {
      const token = await getIdToken();
      const payload = review.isHidden
        ? await showAdminReview(token, review.id)
        : await hideAdminReview(token, review.id);
      const updatedReview = payload.data?.review;

      if (updatedReview) {
        setReviews((current) =>
          current.map((item) => (item.id === updatedReview.id ? updatedReview : item))
        );
      } else {
        await loadReviews();
      }

      showMessage(payload.message || (review.isHidden ? 'Đã hiện lại đánh giá.' : 'Đã ẩn đánh giá.'));
    } catch (actionError) {
      setError(actionError.message || 'Không cập nhật được trạng thái đánh giá.');
    } finally {
      setActionLoadingId('');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await deleteAdminReview(token, deleteTarget.id);
      setReviews((current) => current.filter((item) => item.id !== deleteTarget.id));
      setPagination((current) => ({
        ...current,
        total: Math.max(0, (current.total || 0) - 1),
      }));
      setDeleteTarget(null);
      showMessage(payload.message || 'Đã xóa mềm đánh giá.');
    } catch (actionError) {
      setError(actionError.message || 'Không xóa được đánh giá.');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Quản lý đánh giá</h1>
          <p>Theo dõi, lọc và xử lý đánh giá sản phẩm từ người dùng.</p>
        </div>
      </header>

      <section className="filter-card">
        <form className="filter-form" onSubmit={handleSearchSubmit}>
          <label className="filter-search">
            Tìm kiếm
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nội dung đánh giá, tên sản phẩm..."
            />
          </label>
          <button type="submit" className="primary-btn">
            Tìm
          </button>
        </form>

        <div className="filter-grid review-filter-grid">
          <label>
            Số sao
            <select value={ratingFilter} onChange={handleRatingChange}>
              {RATING_OPTIONS.map((option) => (
                <option key={option.value || 'all-rating'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Trạng thái
            <select value={statusFilter} onChange={handleStatusChange}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all-status'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {snackbar ? <p className="snackbar">{snackbar}</p> : null}

      <div className="account-table-wrap">
        <table className="account-table review-table">
          <thead>
            <tr>
              <th>Người đánh giá</th>
              <th>Đối tượng</th>
              <th>Đánh giá</th>
              <th>Thời gian</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-card">Đang tải danh sách đánh giá...</div>
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-card">Không tìm thấy đánh giá phù hợp.</div>
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <div className="account-primary">
                      {review.reviewer.fullName || review.reviewer.userName}
                    </div>
                    <div className="account-secondary">{review.reviewer.email || '—'}</div>
                  </td>
                  <td>
                    <div className="account-primary">{review.productName}</div>
                    <div className="account-secondary">Gian hàng: {review.shopName}</div>
                  </td>
                  <td className="review-content-cell">
                    <StarRating rating={review.rating} />
                    <p className="review-comment">{review.comment}</p>
                    {review.isHidden ? (
                      <span className="badge badge-neutral review-status-badge">Đã ẩn</span>
                    ) : (
                      <span className="badge badge-success review-status-badge">Đang hiển thị</span>
                    )}
                  </td>
                  <td>
                    <div className="account-secondary">{formatDate(review.createdAt)}</div>
                  </td>
                  <td>
                    <div className="review-action-row">
                      <button
                        type="button"
                        className={
                          review.isHidden
                            ? 'review-action-btn outline-btn-show'
                            : 'review-action-btn outline-btn-hide'
                        }
                        disabled={actionLoadingId === review.id}
                        onClick={() => handleToggleHidden(review)}
                      >
                        {actionLoadingId === review.id
                          ? 'Đang xử lý...'
                          : review.isHidden
                            ? 'Hiện lại'
                            : 'Ẩn đánh giá'}
                      </button>
                      <button
                        type="button"
                        className="review-action-btn outline-btn-delete"
                        onClick={() => setDeleteTarget(review)}
                        aria-label="Xóa đánh giá"
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
      </div>

      <div className="pagination-row">
        <span>{pagination.total || 0} đánh giá</span>
        <div className="pagination-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Trang trước
          </button>
          <span>
            Trang {pagination.page || page} / {pagination.totalPages || 1}
          </span>
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || page >= (pagination.totalPages || 1)}
            onClick={() => setPage((current) => current + 1)}
          >
            Trang sau
          </button>
        </div>
      </div>

      <DeleteConfirmDialog
        review={deleteTarget}
        loading={deleteLoading}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

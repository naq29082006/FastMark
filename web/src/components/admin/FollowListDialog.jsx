import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import AdminPagination from './AdminPagination';
import { EmptyState } from '../ui/Feedback';
import { formatDate } from '../../utils/format';
import PreviewableImage from '../../components/PreviewableImage';

const TITLES = {
  following: 'Đang theo dõi',
  followers: 'Đã theo dõi',
};

export default function FollowListDialog({ open, type, entityLabel, loadPage, onClose }) {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    if (!open || !loadPage) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = await loadPage({ page, limit });
      setItems(payload?.data?.items || []);
      setPagination(payload?.data?.pagination || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách.');
      setItems([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [limit, loadPage, open, page]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setItems([]);
      setPagination(null);
      setError('');
      return;
    }
    loadItems();
  }, [loadItems, open]);

  if (!open) {
    return null;
  }

  const title = TITLES[type] || 'Danh sách theo dõi';

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide follow-list-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-list-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3 id="follow-list-title">{title}</h3>
            {entityLabel ? <p className="muted">{entityLabel}</p> : null}
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}

        {loading ? (
          <div className="follow-list-loading">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton skeleton-line" />
            ))}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <EmptyState title="Chưa có ai trong danh sách này." />
        ) : null}

        {!loading && items.length > 0 ? (
          <ul className="follow-list-items">
            {items.map((item) => {
              const displayName = item.fullName || item.shopName || item.userName || 'Người dùng';
              const handle = item.userName || item.shopUsername || '';
              return (
                <li key={item.id}>
                  <Link className="follow-list-item" to={`/accounts/${item.userId || item.id}`} onClick={onClose}>
                    <PreviewableImage
                      src={item.avatar || item.shopAvatar}
                      alt={displayName}
                      width={44}
                      height={44}
                      shape="circle"
                      className="follow-list-avatar"
                      fallbackLetter={displayName}
                      fallbackClassName="follow-list-avatar placeholder"
                    />
                    <div className="follow-list-meta">
                      <strong>{displayName}</strong>
                      {handle ? <span>@{handle}</span> : null}
                      {item.shopName && item.fullName ? (
                        <em>{item.shopName}</em>
                      ) : null}
                      {item.followedAt ? (
                        <small>Theo dõi từ {formatDate(item.followedAt)}</small>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        {pagination && pagination.totalPages > 1 ? (
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            loading={loading}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}

export function FollowStatButton({ icon: Icon, label, count, onClick }) {
  return (
    <button type="button" className="shop-detail-hero-stat-link" onClick={onClick}>
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      <span>{label}:</span>
      <strong>{count ?? 0}</strong>
    </button>
  );
}

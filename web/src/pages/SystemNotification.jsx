import { useCallback, useEffect, useState } from 'react';

import { getBroadcastHistory, sendSystemNotification } from '../api/notificationApi';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminPagination from '../components/admin/AdminPagination';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'buyer', label: 'Người mua' },
  { value: 'seller', label: 'Người bán' },
];

const AUDIENCE_LABELS = {
  buyer: 'Người mua',
  seller: 'Người bán',
  system: 'Tất cả',
};

const EMPTY_FORM = {
  title: '',
  content: '',
  audience: 'all',
};

export default function SystemNotification() {
  const { getIdToken } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState({ items: [], pagination: null });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(DEFAULT_PAGE_SIZE);
  const [historyLoading, setHistoryLoading] = useState(true);
  const {
    from: historyFrom,
    to: historyTo,
    preset: historyPreset,
    applyRange: applyHistoryRange,
    queryParams: historyQueryParams,
  } = useAdminDateFilter();

  const loadHistory = useCallback(async (overrides = {}) => {
    const pageToLoad = overrides.page ?? historyPage;
    setHistoryLoading(true);
    try {
      const token = await getIdToken();
      const payload = await getBroadcastHistory(token, {
        page: pageToLoad,
        limit: historyLimit,
        ...historyQueryParams,
      });
      setHistory({
        items: payload.data?.items || [],
        pagination: payload.data?.pagination || null,
      });
      if (overrides.page != null && overrides.page !== historyPage) {
        setHistoryPage(overrides.page);
      }
    } catch {
      // Lịch sử là phụ trợ; lỗi tải không chặn form gửi.
    } finally {
      setHistoryLoading(false);
    }
  }, [getIdToken, historyFrom, historyLimit, historyQueryParams, historyPage, historyTo]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setSnackbar(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [snackbar]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setLastResult(null);

    try {
      const token = await getIdToken();
      const payload = await sendSystemNotification(token, form);
      setSnackbar(payload.message || 'Đã gửi thông báo hệ thống thành công.');
      setLastResult(payload.data || null);
      setForm(EMPTY_FORM);
      await loadHistory({ page: 1 });
    } catch (submitError) {
      setError(submitError.message || 'Không gửi được thông báo hệ thống.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page notifications-admin-page">
      {snackbar ? <p className="snackbar">{snackbar}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="category-form-card notification-form-card">
        <div className="category-form-header">
          <h2>Tạo thông báo mới</h2>
          <p className="muted">Gửi thông báo toàn hệ thống tới người mua, người bán hoặc tất cả.</p>
        </div>

        <form className="category-form notification-form" onSubmit={handleSubmit}>
          <label>
            Tiêu đề thông báo
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="VD: Bảo trì hệ thống, Cập nhật chính sách..."
              required
            />
          </label>

          <label>
            Nội dung thông báo
            <textarea
              rows={6}
              value={form.content}
              onChange={(event) => updateField('content', event.target.value)}
              placeholder="Nhập nội dung chi tiết gửi tới người dùng..."
              required
            />
          </label>

          <label>
            Đối tượng nhận
            <select
              value={form.audience}
              onChange={(event) => updateField('audience', event.target.value)}
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="primary-btn notification-submit-btn" disabled={loading}>
            {loading ? 'Đang gửi...' : 'Gửi thông báo toàn hệ thống'}
          </button>
        </form>
      </section>

      {lastResult ? (
        <section className="detail-card detail-card-wide notification-result-card">
          <h3>Kết quả gửi gần nhất</h3>
          <dl className="detail-list">
            <div><dt>Đối tượng</dt><dd>{lastResult.audienceLabel}</dd></div>
            <div><dt>Số người nhận</dt><dd>{lastResult.recipientCount}</dd></div>
            <div><dt>Thông báo in-app</dt><dd>{lastResult.inAppCount}</dd></div>
            <div><dt>Thời gian gửi</dt><dd>{new Date(lastResult.sentAt).toLocaleString('vi-VN')}</dd></div>
          </dl>
        </section>
      ) : null}

      <section className="table-card notification-history-card">
        <header className="notification-history-head">
          <div>
            <h2>Lịch sử gửi thông báo</h2>
            <p className="muted">Chỉ hiển thị các lần admin gửi broadcast từ trang này.</p>
          </div>
          <div className="notification-history-tools">
            <AdminDateFilter
              from={historyFrom}
              to={historyTo}
              preset={historyPreset}
              onApply={(range) => applyHistoryRange(range, () => setHistoryPage(1))}
            />
            <button type="button" className="ghost-btn" onClick={loadHistory} disabled={historyLoading}>
              Làm mới
            </button>
          </div>
        </header>

        {historyLoading ? (
          <div className="skeleton skeleton-line" style={{ height: 90 }} />
        ) : history.items.length === 0 ? (
          <p className="empty-inline">Chưa có thông báo broadcast nào được gửi.</p>
        ) : (
          <div className="notification-history-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Tiêu đề</th>
                  <th>Nội dung</th>
                  <th>Đối tượng</th>
                  <th>Người nhận</th>
                  <th>Đã đọc</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.id || `${item.audience}-${item.sentAt}-${item.title}-${item.content}`}>
                    <td>{item.sentAt ? new Date(item.sentAt).toLocaleString('vi-VN') : ''}</td>
                    <td>{item.title || ''}</td>
                    <td className="category-desc-cell">{item.content || ''}</td>
                    <td>{AUDIENCE_LABELS[item.audience] || item.audience || ''}</td>
                    <td>{item.recipientCount}</td>
                    <td>{item.readCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-pagination">
          <AdminPagination
            page={history.pagination?.page || historyPage}
            totalPages={history.pagination?.totalPages || 1}
            total={history.pagination?.total || 0}
            label="thông báo"
            limit={historyLimit}
            onLimitChange={(next) => {
              setHistoryLimit(next);
              setHistoryPage(1);
            }}
            loading={historyLoading}
            onPageChange={setHistoryPage}
          />
        </div>
      </section>
    </div>
  );
}

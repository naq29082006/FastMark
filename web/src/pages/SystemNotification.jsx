import { useEffect, useState } from 'react';

import { sendSystemNotification } from '../api/notificationApi';
import { useAuth } from '../context/AuthContext';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'buyer', label: 'Người mua' },
  { value: 'seller', label: 'Người bán' },
];

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
    } catch (submitError) {
      setError(submitError.message || 'Không gửi được thông báo hệ thống.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Thông báo</h1>
          <p>Gửi thông báo tới người dùng qua hệ thống in-app.</p>
        </div>
      </header>

      {snackbar ? <p className="snackbar">{snackbar}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="category-form-card notification-form-card">
        <div className="category-form-header">
          <h2>Tạo thông báo mới</h2>
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
        <section className="detail-card detail-card-wide">
          <h3>Kết quả gửi gần nhất</h3>
          <dl className="detail-list">
            <div><dt>Đối tượng</dt><dd>{lastResult.audienceLabel}</dd></div>
            <div><dt>Số người nhận</dt><dd>{lastResult.recipientCount}</dd></div>
            <div><dt>Thông báo in-app</dt><dd>{lastResult.inAppCount}</dd></div>
            <div><dt>Thời gian gửi</dt><dd>{new Date(lastResult.sentAt).toLocaleString('vi-VN')}</dd></div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}

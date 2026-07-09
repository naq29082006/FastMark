import { useCallback, useEffect, useState } from 'react';

import {
  approveVerification,
  listPendingVerifications,
  rejectVerification,
} from '../api/sellerApi';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('vi-VN');
}

export default function SellerVerificationsPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');
  const [rejectReasons, setRejectReasons] = useState({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await listPendingVerifications(token);
      setItems(payload.data?.verifications || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách chờ duyệt.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadItems();
    const intervalId = setInterval(loadItems, 5000);
    return () => clearInterval(intervalId);
  }, [loadItems]);

  async function handleApprove(verificationId) {
    setActionId(verificationId);
    setError('');

    try {
      const token = await getIdToken();
      await approveVerification(token, verificationId);
      await loadItems();
    } catch (approveError) {
      setError(approveError.message || 'Không duyệt được hồ sơ.');
    } finally {
      setActionId('');
    }
  }

  async function handleReject(verificationId) {
    const lyDoTuChoi = String(rejectReasons[verificationId] || '').trim();
    if (!lyDoTuChoi) {
      setError('Vui lòng nhập lý do từ chối.');
      return;
    }

    setActionId(verificationId);
    setError('');

    try {
      const token = await getIdToken();
      await rejectVerification(token, verificationId, lyDoTuChoi);
      setRejectReasons((current) => ({ ...current, [verificationId]: '' }));
      await loadItems();
    } catch (rejectError) {
      setError(rejectError.message || 'Không từ chối được hồ sơ.');
    } finally {
      setActionId('');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Duyệt đăng ký người bán</h1>
          <p>Danh sách hồ sơ đang chờ duyệt. Tự động cập nhật mỗi 5 giây.</p>
        </div>
        <button type="button" onClick={loadItems} disabled={loading}>
          Làm mới
        </button>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {loading && items.length === 0 ? <p>Đang tải...</p> : null}

      {!loading && items.length === 0 ? (
        <div className="empty-card">Không có hồ sơ nào đang chờ duyệt.</div>
      ) : null}

      <div className="verification-list">
        {items.map((item) => (
          <article key={item.id} className="verification-card">
            <div className="verification-header">
              <div>
                <h2>{item.user?.fullName || 'Người dùng'}</h2>
                <p>
                  {item.user?.email || '—'} • {item.user?.phone || '—'}
                </p>
              </div>
              <span className="status-pill">Chờ duyệt</span>
            </div>

            <div className="verification-grid">
              <div>
                <strong>Địa chỉ</strong>
                <p>{item.address || '—'}</p>
              </div>
              <div>
                <strong>Địa chỉ hệ thống</strong>
                <p>{item.DiaChiHeThong || '—'}</p>
              </div>
              <div>
                <strong>Ghi chú</strong>
                <p>{item.note || '—'}</p>
              </div>
              <div>
                <strong>Gửi lúc</strong>
                <p>{formatDate(item.submittedAt)}</p>
              </div>
            </div>

            <div className="image-grid">
              {item.cccdFrontImage ? (
                <a href={item.cccdFrontImage} target="_blank" rel="noreferrer">
                  <img src={item.cccdFrontImage} alt="CCCD mặt trước" />
                  <span>CCCD trước</span>
                </a>
              ) : null}
              {item.cccdBackImage ? (
                <a href={item.cccdBackImage} target="_blank" rel="noreferrer">
                  <img src={item.cccdBackImage} alt="CCCD mặt sau" />
                  <span>CCCD sau</span>
                </a>
              ) : null}
              {item.selfieImage ? (
                <a href={item.selfieImage} target="_blank" rel="noreferrer">
                  <img src={item.selfieImage} alt="Ảnh chân dung" />
                  <span>Chân dung</span>
                </a>
              ) : null}
            </div>

            <div className="reject-box">
              <label>
                Lý do từ chối
                <textarea
                  rows={3}
                  value={rejectReasons[item.id] || ''}
                  onChange={(event) =>
                    setRejectReasons((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder="Nhập lý do nếu từ chối hồ sơ..."
                />
              </label>
            </div>

            <div className="action-row">
              <button
                type="button"
                className="approve-btn"
                disabled={actionId === item.id}
                onClick={() => handleApprove(item.id)}
              >
                {actionId === item.id ? 'Đang xử lý...' : 'Duyệt'}
              </button>
              <button
                type="button"
                className="reject-btn"
                disabled={actionId === item.id}
                onClick={() => handleReject(item.id)}
              >
                Từ chối
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

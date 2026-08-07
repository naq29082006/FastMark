import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { message } from 'antd';

import { approveVerification, listAdminVerifications, rejectVerification } from '../../api/sellerApi';
import { formatDateTime, verificationStatusLabel } from '../utils/format';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

function statusBadgeClass(status) {
  if (status === 1) return 'badge badge-success';
  if (status === 2) return 'badge badge-danger';
  return 'badge badge-warning';
}

export default function SellerDetailPage() {
  const { verificationId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const payload = await listAdminVerifications(token, {
        search: verificationId,
        limit: 5,
      });
      const rows = payload.data?.verifications || [];
      const found =
        rows.find((row) => String(row.id || row._id) === String(verificationId)) ||
        rows[0] ||
        null;
      if (found && String(found.id || found._id) !== String(verificationId)) {
        setRecord(null);
        return;
      }
      setRecord(found);
    } catch (err) {
      message.error(err.message || 'Không tải được hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, verificationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove() {
    setBusy(true);
    try {
      const token = await getIdToken();
      await approveVerification(token, record.id || record._id);
      message.success('Đã duyệt hồ sơ seller');
      load();
    } catch (err) {
      message.error(err.message || 'Duyệt thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    const reason = window.prompt('Lý do từ chối:');
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      await rejectVerification(token, record.id || record._id, reason.trim());
      message.success('Đã từ chối hồ sơ');
      load();
    } catch (err) {
      message.error(err.message || 'Từ chối thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page admin-detail-page">
        <div className="shop-detail-v2-skeleton">
          <div className="skeleton skeleton-card shop-detail-hero-skeleton" />
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="page admin-detail-page">
        <p className="error-banner">Không tìm thấy hồ sơ xác minh.</p>
        <button type="button" className="ghost-btn" onClick={() => navigate('/sellers')}>
          ← Quay lại danh sách
        </button>
      </div>
    );
  }

  const images = [
    { label: 'CCCD mặt trước', src: record.cccdFrontImage },
    { label: 'CCCD mặt sau', src: record.cccdBackImage },
    { label: 'Selfie', src: record.selfieImage },
    { label: 'Giấy KD / ATTP', src: record.businessImage },
  ].filter((item) => item.src);

  const ownerName = record.user?.fullName || record.ownerName || '—';

  return (
    <div className="page admin-detail-page shop-detail-page-v2">
      <div className="admin-detail-toolbar">
        <button type="button" className="ghost-btn" onClick={() => navigate('/sellers')}>
          ← Quay lại
        </button>
        <div className="admin-detail-toolbar-actions">
          {record.shopId ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/sellers/shops/${record.shopId}`)}
            >
              Xem gian hàng
            </button>
          ) : null}
          {record.status === 0 ? (
            <>
              <button type="button" className="approve-btn" disabled={busy} onClick={handleApprove}>
                Duyệt
              </button>
              <button type="button" className="reject-btn" disabled={busy} onClick={handleReject}>
                Từ chối
              </button>
            </>
          ) : null}
        </div>
      </div>

      <section className="admin-detail-hero">
        {record.shopBanner ? (
          <img
            className="admin-detail-hero-banner"
            src={resolveMediaUrl(record.shopBanner)}
            alt=""
          />
        ) : null}
        <div className="admin-detail-avatar placeholder">
          {(record.shopName || 'S').charAt(0).toUpperCase()}
        </div>
        <div className="admin-detail-hero-body">
          <h1>{record.shopName || 'Hồ sơ seller'}</h1>
          <div className="admin-detail-hero-meta">
            <span className={statusBadgeClass(record.status)}>
              {verificationStatusLabel(record.status)}
            </span>
            {record.shopUsername ? <span className="chip">@{record.shopUsername}</span> : null}
            {record.categoryName ? <span className="chip">{record.categoryName}</span> : null}
          </div>
          <p className="admin-detail-hero-sub">
            Chủ shop: <strong>{ownerName}</strong>
            {record.createdAt ? ` · Gửi ${formatDateTime(record.createdAt)}` : null}
          </p>
        </div>
      </section>

      <section className="admin-detail-grid">
        <article className="admin-detail-card">
          <h2>Thông tin hồ sơ</h2>
          <dl className="admin-detail-dl">
            <div>
              <dt>Tên shop</dt>
              <dd>{record.shopName || '—'}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{record.shopUsername || '—'}</dd>
            </div>
            <div>
              <dt>Chủ shop</dt>
              <dd>{ownerName}</dd>
            </div>
            <div>
              <dt>Danh mục</dt>
              <dd>{record.categoryName || '—'}</dd>
            </div>
            <div>
              <dt>Địa chỉ</dt>
              <dd>{record.addressHeThong || '—'}</dd>
            </div>
            <div>
              <dt>Tọa độ</dt>
              <dd>
                {record.latlong?.lat != null && record.latlong?.long != null
                  ? `${record.latlong.lat}, ${record.latlong.long}`
                  : '—'}
              </dd>
            </div>
            {record.LyDoTuChoi ? (
              <div>
                <dt>Lý do từ chối</dt>
                <dd>{record.LyDoTuChoi}</dd>
              </div>
            ) : null}
          </dl>
        </article>

        <article className="admin-detail-card admin-detail-card-wide">
          <h2>Ảnh xác minh</h2>
          {images.length ? (
            <div className="seller-verify-doc-grid">
              {images.map((item) => {
                const src = resolveMediaUrl(item.src);
                return (
                  <article key={item.label} className="seller-verify-doc-card">
                    <button
                      type="button"
                      className="seller-verify-doc-preview shop-detail-doc-preview-btn"
                      onClick={() => setPreview({ src, label: item.label })}
                    >
                      <img src={src} alt={item.label} />
                    </button>
                    <span>{item.label}</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="admin-detail-empty">Chưa có ảnh xác minh.</p>
          )}
        </article>
      </section>

      {preview ? (
        <div className="image-preview-overlay" role="presentation" onClick={() => setPreview(null)}>
          <div
            className="image-preview-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="ghost-btn image-preview-close" onClick={() => setPreview(null)}>
              Đóng
            </button>
            <img src={preview.src} alt={preview.label} />
            <p>{preview.label}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

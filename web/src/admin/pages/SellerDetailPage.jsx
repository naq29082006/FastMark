import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Input, Modal, message } from 'antd';

import {
  approveVerification,
  listAdminVerifications,
  rejectVerification,
} from '../../api/sellerApi';
import { useAdminTopbar } from '../context/AdminTopbarContext';
import { sellerAdminStatusBadgeClass, sellerAdminStatusLabel } from '../utils/format';
import { useAuth } from '../../context/AuthContext';
import { formatDateTimeDetail } from '../../utils/format';
import PreviewableImage, { VerifyDocCard } from '../../components/PreviewableImage';

function statusBadgeClass(record) {
  return sellerAdminStatusBadgeClass(record);
}

function DetailSkeleton() {
  return (
    <div className="shop-detail-v2-skeleton">
      <div className="skeleton skeleton-card shop-detail-hero-skeleton" />
    </div>
  );
}

function isRecordPendingReReview(row) {
  return Boolean(row?.isPendingReReview || row?.reReviewChangeReason);
}

function formatAttpDateLabel(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '—';
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split('/');
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  return text;
}

function resolvePendingAttpDates(record) {
  return {
    issuedAt: record?.attpMeta?.issuedAt || record?.attpIssuedAt || '',
    expiresAt: record?.attpMeta?.expiresAt || record?.attpExpiresAt || '',
  };
}

export default function SellerDetailPage() {
  const { verificationId } = useParams();
  const { getIdToken } = useAuth();
  const { setTrail, clearTrail } = useAdminTopbar();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);

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
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, verificationId]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = record?.shopName || (loading ? '…' : 'Chi tiết');

  useEffect(() => {
    setTrail([
      { label: 'Người bán', to: '/sellers' },
      { label: displayName },
    ]);
    return () => clearTrail();
  }, [displayName, setTrail, clearTrail]);

  async function handleApproveConfirm() {
    if (!record) {
      return;
    }
    const pendingReReview = isRecordPendingReReview(record);
    if (pendingReReview) {
      const pendingDates = resolvePendingAttpDates(record);
      if (!pendingDates.issuedAt.trim()) {
        message.warning('Hồ sơ thiếu ngày cấp giấy phép từ người bán.');
        return;
      }
      if (!pendingDates.expiresAt.trim()) {
        message.warning('Hồ sơ thiếu ngày hết hạn giấy phép từ người bán.');
        return;
      }
    }
    setBusy(true);
    try {
      const token = await getIdToken();
      await approveVerification(token, record.id || record._id, {});
      message.success('Đã duyệt hồ sơ seller');
      setApproveOpen(false);
      load();
    } catch (err) {
      message.error(err.message || 'Duyệt thất bại');
    } finally {
      setBusy(false);
    }
  }

  function openApproveModal() {
    const pendingReReview = isRecordPendingReReview(record);
    if (pendingReReview) {
      setApproveOpen(true);
      return;
    }
    handleApproveConfirm();
  }

  async function handleRejectConfirm() {
    const reason = rejectReason.trim();
    if (!reason) {
      message.warning('Vui lòng nhập lý do từ chối');
      return;
    }
    setBusy(true);
    try {
      const token = await getIdToken();
      await rejectVerification(token, record.id || record._id, reason);
      message.success('Đã từ chối hồ sơ');
      setRejectOpen(false);
      setRejectReason('');
      load();
    } catch (err) {
      message.error(err.message || 'Từ chối thất bại');
    } finally {
      setBusy(false);
    }
  }

  const images = record
    ? [
        { label: 'Ảnh CCCD mặt trước', src: record.anhCccdTruoc },
        { label: 'Ảnh CCCD mặt sau', src: record.anhCccdSau },
        { label: 'Ảnh chân dung', src: record.selfieImage },
        { label: 'Ảnh giấy phép kinh doanh / ATTP', src: record.anhKD },
      ].filter((item) => item.src)
    : [];

  const ownerName = record?.user?.fullName || record?.ownerName || '—';
  const ownerUsername = record?.user?.userName || '';
  const latitude = record?.latlong?.lat ?? record?.latitude ?? null;
  const longitude = record?.latlong?.long ?? record?.longitude ?? null;
  const hasCoords = latitude != null && longitude != null && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude));
  const isPending = record?.status === 0;
  const isPendingReReview = isRecordPendingReReview(record);
  const previousSnapshot = record?.reReviewPreviousSnapshot || null;
  const systemAddress = record?.addressHeThong || record?.address || '—';

  return (
    <div className="admin-detail-page account-detail-page account-detail-page-v2 shop-detail-page-v2 seller-verify-detail-page">
      {loading ? <DetailSkeleton /> : null}

      {!loading && record ? (
        <>
          <section className="shop-detail-hero">
            <div className="seller-verify-hero-actions seller-verify-hero-actions--corner">
              {record.shopId ? (
                <Link className="ghost-btn" to={`/sellers/shops/${record.shopId}`}>
                  Xem gian hàng
                </Link>
              ) : null}
              {isPending ? (
                <>
                  <button type="button" className="approve-btn" disabled={busy} onClick={openApproveModal}>
                    Duyệt
                  </button>
                  <button
                    type="button"
                    className="reject-btn"
                    disabled={busy}
                    onClick={() => {
                      setRejectReason('');
                      setRejectOpen(true);
                    }}
                  >
                    Từ chối
                  </button>
                </>
              ) : null}
            </div>

            <div className="shop-detail-hero-content account-detail-hero-content seller-verify-hero-head">
              {!isPending ? (
                <div className="account-detail-hero-aside">
                  <PreviewableImage
                    src={record?.shopAvatar || record?.user?.avatar}
                    alt={record.shopName || 'Shop'}
                    width={160}
                    height={160}
                    shape="circle"
                    fallbackLetter={record.shopName || 'S'}
                    wrapperClassName="shop-detail-hero-avatar-wrap"
                    className="shop-detail-hero-avatar"
                  />
                </div>
              ) : null}

              <div className="shop-detail-hero-main seller-verify-hero-head-main">
                <div className="shop-detail-hero-title-row">
                  <h1>{record.shopName || 'Hồ sơ seller'}</h1>
                  <span className={statusBadgeClass(record)}>
                    {sellerAdminStatusLabel(record)}
                  </span>
                </div>
                <p className="shop-detail-hero-handle">
                  {record.shopUsername ? `@${record.shopUsername}` : '—'}
                </p>
                <div className="account-detail-hero-meta-lines">
                  <p className="account-detail-hero-meta-line">
                    <CalendarDays size={14} aria-hidden="true" />
                    <span>
                      Gửi lúc:{' '}
                      <strong>{formatDateTimeDetail(record.createdAt || record.submittedAt) || '—'}</strong>
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="seller-verify-hero-body">
              <div className="seller-verify-register-panel">
                <h3>Thông tin đăng ký</h3>
                <ul className="seller-verify-register-list">
                  <li>
                    <span className="seller-verify-register-label">Họ tên (trên CCCD)</span>
                    <span className="seller-verify-register-value">{record.fullName || '—'}</span>
                  </li>
                  <li>
                    <span className="seller-verify-register-label">Số CCCD/CMND</span>
                    <span className="seller-verify-register-value">{record.cccdNumber || '—'}</span>
                  </li>
                  <li>
                    <span className="seller-verify-register-label">Tên gian hàng</span>
                    <span className="seller-verify-register-value">{record.shopName || '—'}</span>
                  </li>
                  <li>
                    <span className="seller-verify-register-label">Username gian hàng</span>
                    <span className="seller-verify-register-value">
                      {record.shopUsername ? `@${record.shopUsername}` : '—'}
                    </span>
                  </li>
                  <li>
                    <span className="seller-verify-register-label">Danh mục kinh doanh</span>
                    <span className="seller-verify-register-value">{record.categoryName || '—'}</span>
                  </li>
                  <li className="seller-verify-register-list-item-coords">
                    <span className="seller-verify-register-label">Tọa độ</span>
                    <span className="seller-verify-register-value seller-verify-register-coords-wrap">
                      {hasCoords ? (
                        <>
                          <span className="seller-verify-register-coords">Lat: {latitude}</span>
                          <span className="seller-verify-register-coords">Long: {longitude}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </li>
                  <li className="seller-verify-register-list-item-address">
                    <span className="seller-verify-register-label">Địa chỉ</span>
                    <span className="seller-verify-register-value">{systemAddress}</span>
                  </li>
                </ul>

                {record.lyDoTuChoi || record.LyDoTuChoi ? (
                  <div className="seller-verify-reject-reason">
                    <span className="seller-verify-register-label">Lý do từ chối</span>
                    <p>{record.lyDoTuChoi || record.LyDoTuChoi}</p>
                  </div>
                ) : null}
              </div>

              <aside className="seller-verify-owner-panel shop-detail-panel account-detail-overview-card">
                <div className="shop-detail-panel-head">
                  <h3>Chủ gian hàng</h3>
                </div>
                <div className="shop-detail-owner">
                  <PreviewableImage
                    src={record?.user?.avatar}
                    alt={ownerName || 'Chủ gian hàng'}
                    width={56}
                    height={56}
                    shape="circle"
                    fallbackLetter={ownerName || 'U'}
                    className="shop-detail-owner-avatar"
                  />
                  <div>
                    <strong>{ownerName}</strong>
                    <span className="shop-detail-owner-handle">
                      {ownerUsername ? `@${ownerUsername}` : '—'}
                    </span>
                  </div>
                </div>
                <dl className="shop-detail-dl compact account-detail-overview-card-body">
                  {record.user?.email ? (
                    <div>
                      <dt>Email</dt>
                      <dd>{record.user.email}</dd>
                    </div>
                  ) : null}
                  {record.user?.phone ? (
                    <div>
                      <dt>Số điện thoại</dt>
                      <dd>{record.user.phone}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>
                      <span className={statusBadgeClass(record)}>
                        {sellerAdminStatusLabel(record)}
                      </span>
                    </dd>
                  </div>
                </dl>
                {record.user?.id ? (
                  <Link className="detail-btn shop-detail-side-actions" to={`/users/${record.user.id}`}>
                    Xem chi tiết chủ gian hàng
                  </Link>
                ) : (
                  <p className="muted account-detail-overview-card-body">Không có tài khoản liên kết.</p>
                )}
              </aside>
            </div>

            {isPendingReReview ? (
              <div className="seller-verify-rereview-panel">
                <h3>Duyệt lại hồ sơ xác thực</h3>
                <p className="muted">
                  Ngày gửi:{' '}
                  {record.reReviewSubmittedAt
                    ? formatDateTimeDetail(record.reReviewSubmittedAt)
                    : formatDateTimeDetail(record.updatedAt)}
                </p>
                <p>
                  <strong>Lý do thay đổi:</strong> {record.reReviewChangeReason || '—'}
                </p>
                <div className="seller-verify-rereview-grid">
                  <div>
                    <h4>Hồ sơ cũ</h4>
                    {previousSnapshot?.anhKD ? (
                      <VerifyDocCard
                        variant="portrait"
                        label="Giấy phép ATTP (cũ)"
                        url={previousSnapshot.anhKD}
                      />
                    ) : (
                      <p className="admin-detail-empty">Không có ảnh cũ.</p>
                    )}
                    <ul className="seller-verify-register-list">
                      <li>
                        <span>Ngày cấp:</span> {formatAttpDateLabel(previousSnapshot?.issuedAt)}
                      </li>
                      <li>
                        <span>Ngày hết hạn:</span> {formatAttpDateLabel(previousSnapshot?.expiresAt)}
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4>Hồ sơ mới</h4>
                    {record.anhKD ? (
                      <VerifyDocCard variant="portrait" label="Giấy phép ATTP (mới)" url={record.anhKD} />
                    ) : null}
                    <ul className="seller-verify-register-list">
                      <li>
                        <span>Ngày cấp:</span> {formatAttpDateLabel(resolvePendingAttpDates(record).issuedAt)}
                      </li>
                      <li>
                        <span>Ngày hết hạn:</span> {formatAttpDateLabel(resolvePendingAttpDates(record).expiresAt)}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="seller-verify-hero-docs">
              <h3>Ảnh xác minh</h3>
              {images.length ? (
                <div className="seller-verify-doc-grid shop-detail-verify-doc-grid">
                  {images.map((item) => (
                    <VerifyDocCard key={item.label} label={item.label} url={item.src} />
                  ))}
                </div>
              ) : (
                <p className="admin-detail-empty">Chưa có ảnh xác minh.</p>
              )}
            </div>
          </section>
        </>
      ) : null}

      {!loading && !record ? (
        <p className="error-banner">Không tìm thấy hồ sơ xác minh.</p>
      ) : null}

      <Modal
        title="Duyệt lại hồ sơ xác thực"
        open={approveOpen}
        okText="Duyệt"
        okButtonProps={{ loading: busy }}
        cancelText="Huỷ"
        onOk={handleApproveConfirm}
        onCancel={() => setApproveOpen(false)}
      >
        <p style={{ marginBottom: 8 }}>
          Xác nhận duyệt giấy phép ATTP mới của{' '}
          <strong>{record?.shopName || 'gian hàng'}</strong>?
        </p>
        <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
          Ngày cấp và ngày hết hạn do người bán khai báo — xem lại ở mục{' '}
          <strong>Hồ sơ mới</strong> phía trên. Admin chỉ duyệt hoặc từ chối, không chỉnh sửa
          thông tin này.
        </p>
      </Modal>

      <Modal
        title="Từ chối hồ sơ"
        open={rejectOpen}
        okText="Từ chối"
        okButtonProps={{ danger: true, loading: busy }}
        cancelText="Huỷ"
        onOk={handleRejectConfirm}
        onCancel={() => {
          setRejectOpen(false);
          setRejectReason('');
        }}
      >
        <p>
          Từ chối hồ sơ của <strong>{record?.shopName || 'seller'}</strong>?
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Lý do từ chối (bắt buộc)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

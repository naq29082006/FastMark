import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  getReservationDetail,
  refundReservation,
  releaseReservation,
} from '../api/reservationAdminApi';
import ReservationOrderProgress from '../components/admin/ReservationOrderProgress';
import { useAuth } from '../context/AuthContext';
import { useAdminOrderSocket } from '../hooks/useAdminOrderSocket';
import { goBackOr } from '../utils/navigation';
import { formatDate, formatDateActivity, formatDateTimeDetail, formatPrice } from '../utils/format';
import { formatReservationOrderCode } from '../utils/reservationOrderCode';
import { keepIfSame } from '../utils/realtimeList';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { resolveAdminListStatusMeta } from '../utils/reservationOrderTimeline';

const AUDIT_ACTION_LABELS = {
  ADMIN_REFUND_BUYER: 'Hoàn cọc cho người mua',
  ADMIN_RELEASE_SELLER: 'Giải phóng cọc cho người bán',
};

const DISPUTED_STATUS = 4;

function resolveListStatusMeta(reservation) {
  return resolveAdminListStatusMeta(reservation);
}

function DetailSkeleton() {
  return (
    <div className="reservation-order-layout">
      <div className="skeleton skeleton-card reservation-order-header-card" />
      <div className="reservation-order-cards">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton skeleton-card reservation-order-info-card" />
        ))}
      </div>
    </div>
  );
}

function PartyAvatar({ src, fallback }) {
  if (src) {
    return <img src={src} alt="" className="reservation-party-avatar" />;
  }
  return (
    <div className="reservation-party-avatar reservation-party-avatar--fallback">
      {String(fallback || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function resolveUnitPrice(reservation) {
  const agreed = Number(reservation?.agreedPrice);
  const reserved = Number(reservation?.reservedPrice) || 0;
  if (Number.isFinite(agreed) && agreed > 0) {
    return agreed;
  }
  return reserved;
}

function resolveOriginalUnitPrice(reservation) {
  const variantPrice = Number(reservation?.variant?.price) || 0;
  const unitPrice = resolveUnitPrice(reservation);
  if (variantPrice > unitPrice) {
    return variantPrice;
  }
  const reserved = Number(reservation?.reservedPrice) || 0;
  if (reserved > unitPrice) {
    return reserved;
  }
  return 0;
}

function resolveDiscountPercent(originalPrice, unitPrice) {
  if (!originalPrice || originalPrice <= unitPrice) {
    return 0;
  }
  return Math.round(((originalPrice - unitPrice) / originalPrice) * 100);
}

function formatPickupTime(value) {
  const formatted = formatDateActivity(value);
  if (!formatted) return '—';
  return `${formatted.time} · ${formatted.day}`;
}

function OrderSummaryRow({ label, value, emphasize = false }) {
  return (
    <div className="reservation-order-summary-row">
      <span>{label}</span>
      <strong className={emphasize ? 'reservation-order-summary-emphasis' : undefined}>{value}</strong>
    </div>
  );
}

function OrderProductLine({ product, variant, quantity, unitPrice, originalUnitPrice, discountPercent, onOpenProduct }) {
  const thumb = resolveMediaUrl(
    product?.thumbnail || variant?.imageUrl || product?.thumbnails?.[0] || '',
  );
  const productName = product?.productName || '—';
  const variantName = variant?.variantName || '—';

  return (
    <div className="reservation-order-product-line">
      {thumb ? (
        <img src={thumb} alt="" className="reservation-order-product-thumb" />
      ) : (
        <span className="reservation-order-product-thumb reservation-order-product-thumb--placeholder">SP</span>
      )}
      <div className="reservation-order-product-body">
        <div className="reservation-order-product-name-row">
          {product?.id ? (
            <button type="button" className="link-btn link-btn-plain" onClick={onOpenProduct}>
              {productName}
            </button>
          ) : (
            <strong>{productName}</strong>
          )}
        </div>
        <p className="reservation-order-product-variant">Phân loại: {variantName}</p>
        <div className="reservation-order-product-price-row">
          {originalUnitPrice > unitPrice ? (
            <>
              <span className="reservation-order-price-original">{formatPrice(originalUnitPrice)}</span>
              <span>{formatPrice(unitPrice)}</span>
              {discountPercent > 0 ? (
                <span className="reservation-order-price-discount">Giảm {discountPercent}%</span>
              ) : null}
            </>
          ) : (
            <span>{formatPrice(unitPrice)}</span>
          )}
          <span className="reservation-order-product-qty">× {quantity || 0}</span>
        </div>
      </div>
    </div>
  );
}

function DisputeResolutionModal({ mode, note, loading, onChangeNote, onClose, onConfirm }) {
  const isRefund = mode === 'refund';
  const title = isRefund ? 'Hoàn cọc cho người mua' : 'Giải phóng cọc cho người bán';
  const description = isRefund
    ? 'Tiền cọc sẽ hoàn về ví người mua. Nội dung bên dưới sẽ được gửi thông báo cho cả buyer và seller.'
    : 'Tiền cọc sẽ chuyển vào ví người bán. Nội dung bên dưới sẽ được gửi thông báo cho cả buyer và seller.';
  const trimmed = String(note || '').trim();
  const canSubmit = trimmed.length >= 5 && !loading;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <label className="report-reply-field">
          <strong>Nội dung xử lý (bắt buộc)</strong>
          <textarea
            rows={5}
            value={note}
            onChange={(event) => onChangeNote(event.target.value)}
            placeholder="Nhập nội dung gửi thông báo cho cả hai bên..."
          />
        </label>
        <div className="report-action-row">
          <button type="button" className="ghost-btn" disabled={loading} onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className={isRefund ? 'danger-btn' : 'approve-btn'}
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận xử lý'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReservationDetailPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resolutionModal, setResolutionModal] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const loadDetail = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const token = await getIdToken();
        const payload = await getReservationDetail(token, reservationId);
        const next = payload.data?.reservation || null;
        // Giữ nguyên state nếu dữ liệu không đổi → không render lại cả trang.
        setReservation((current) => keepIfSame(current, next));
      } catch (loadError) {
        if (silent) {
          return;
        }
        setError(loadError.message || 'Không tải được chi tiết đơn hàng.');
        setReservation(null);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [getIdToken, reservationId]
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleOrderUpdated = useCallback(
    (payload) => {
      if (!payload?.reservationId || String(payload.reservationId) !== String(reservationId)) {
        return;
      }
      // Cập nhật im lặng: không bật skeleton, không nháy nội dung đang xem.
      loadDetail({ silent: true });
    },
    [loadDetail, reservationId]
  );

  useAdminOrderSocket({
    enabled: Boolean(reservationId),
    getIdToken,
    onOrderUpdated: handleOrderUpdated,
  });

  useEffect(() => {
    if (!message) return undefined;
    const timeoutId = setTimeout(() => setMessage(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [message]);

  function openResolutionModal(mode) {
    setResolutionModal(mode);
    setResolutionNote('');
    setError('');
  }

  function closeResolutionModal() {
    if (actionLoading) return;
    setResolutionModal('');
    setResolutionNote('');
  }

  async function handleConfirmResolution() {
    const note = String(resolutionNote || '').trim();
    if (note.length < 5) {
      setError('Vui lòng nhập nội dung xử lý (ít nhất 5 ký tự).');
      return;
    }

    const mode = resolutionModal;
    setActionLoading(mode);
    setError('');
    try {
      const token = await getIdToken();
      const payload =
        mode === 'refund'
          ? await refundReservation(token, reservationId, note)
          : await releaseReservation(token, reservationId, note);
      setReservation(payload.data?.reservation || null);
      setMessage(
        payload.message ||
          (mode === 'refund' ? 'Đã hoàn cọc cho người mua.' : 'Đã giải phóng cọc cho người bán.')
      );
      setResolutionModal('');
      setResolutionNote('');
    } catch (actionError) {
      setError(actionError.message || 'Không xử lý được tranh chấp.');
    } finally {
      setActionLoading('');
    }
  }

  const buyer = reservation?.buyer;
  const seller = reservation?.seller;
  const shop = reservation?.shopInfo || reservation?.shop;
  const product = reservation?.product;
  const buyerStats = reservation?.buyerStats;
  const sellerStats = reservation?.sellerStats || reservation?.shopStats;
  const auditLogs = reservation?.auditLogs || [];
  const isDisputed = Number(reservation?.status) === DISPUTED_STATUS;
  const bothReported = Boolean(reservation?.disputeByBuyer) && Boolean(reservation?.disputeBySeller);
  const isPostDeliveryDispute = Boolean(reservation?.isPostDeliveryDispute);
  const canAdminProcessDispute =
    isDisputed &&
    (bothReported ||
      (isPostDeliveryDispute && reservation?.awaitingAdminDisputeReview === true));
  const singleSideDispute = isDisputed && !bothReported && !canAdminProcessDispute;
  const sellerResponse = reservation?.sellerResponse;

  const orderCode = formatReservationOrderCode(reservation);
  const statusMeta = resolveListStatusMeta(reservation);
  const quantity = Number(reservation?.quantity) || 0;
  const unitPrice = resolveUnitPrice(reservation);
  const originalUnitPrice = resolveOriginalUnitPrice(reservation);
  const discountPercent = resolveDiscountPercent(originalUnitPrice, unitPrice);
  const subtotal = unitPrice * quantity;
  const depositAmount = Number(reservation?.depositAmount) || 0;
  const cashDueOnPickup = Math.max(0, subtotal - depositAmount);

  const sellerName =
    shop?.shopName || reservation?.shopName || seller?.fullName || '';
  const sellerNick = shop?.shopUsername || shop?.userName || seller?.userName || '';
  const sellerAvatar = shop?.avatar || seller?.avatar || '';
  const sellerAccountId = seller?.id || shop?.userId || '';
  const shopAddress = shop?.address || shop?.addressHeThong || shop?.systemAddress || '';

  const hasDisputeSection =
    isDisputed ||
    reservation?.disputeByBuyer ||
    reservation?.disputeBySeller ||
    reservation?.disputedAt ||
    (Array.isArray(reservation?.disputeReports) && reservation.disputeReports.length > 0);

  return (
    <div className="admin-detail-page reservation-detail-page reservation-order-page">
      <header className="admin-detail-toolbar reservation-order-toolbar no-print">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => goBackOr(navigate, '/reservations')}
        >
          ← Quay lại
        </button>
        <div className="header-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={loadDetail}
            disabled={loading || Boolean(actionLoading)}
          >
            Làm mới
          </button>
          {canAdminProcessDispute ? (
            <>
              <button
                type="button"
                className="danger-btn"
                disabled={Boolean(actionLoading)}
                onClick={() => openResolutionModal('refund')}
              >
                {actionLoading === 'refund' ? '...' : 'Hoàn cọc buyer'}
              </button>
              <button
                type="button"
                className="approve-btn"
                disabled={Boolean(actionLoading)}
                onClick={() => openResolutionModal('release')}
              >
                {actionLoading === 'release' ? '...' : 'Giải phóng seller'}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <div className="snackbar">{message}</div> : null}

      {loading ? <DetailSkeleton /> : null}

      {!loading && !reservation ? (
        <section className="table-card">
          <p>Không tìm thấy đơn hàng.</p>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => goBackOr(navigate, '/reservations')}
          >
            Quay lại
          </button>
        </section>
      ) : null}

      {!loading && reservation ? (
        <div className="reservation-order-layout">
          <section className="reservation-order-header-card">
            <div className="reservation-order-header-main">
              <div className="reservation-order-header-copy">
                <h1>Đơn hàng #{orderCode}</h1>
                <div className="reservation-order-header-meta">
                  <span>
                    <strong>Đặt lúc:</strong> {formatDateTimeDetail(reservation.createdAt)}
                  </span>
                  <span>
                    <strong>Cập nhật cuối:</strong> {formatDateTimeDetail(reservation.updatedAt)}
                  </span>
                </div>
              </div>
              <span className={`reservation-order-header-status ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
            <ReservationOrderProgress reservation={reservation} />
          </section>

          <div className="reservation-order-cards">
            <article className="reservation-order-info-card">
              <h2>Thông tin đơn hàng</h2>

              <OrderProductLine
                product={product}
                variant={reservation.variant}
                quantity={quantity}
                unitPrice={unitPrice}
                originalUnitPrice={originalUnitPrice}
                discountPercent={discountPercent}
                onOpenProduct={() =>
                  navigate(`/products?search=${encodeURIComponent(product?.productName || '')}`)
                }
              />

              <div className="reservation-order-summary">
                <OrderSummaryRow label="Tổng tiền hàng" value={formatPrice(subtotal)} />
                <OrderSummaryRow label="Tiền đặt cọc" value={formatPrice(depositAmount)} />
                <OrderSummaryRow
                  label="Giờ nhận hàng"
                  value={formatPickupTime(reservation.pickupTime)}
                />
                {reservation.note ? (
                  <div className="reservation-order-note-block">
                    <span className="reservation-order-note-label">Ghi chú</span>
                    <p className="reservation-order-note-text">{reservation.note}</p>
                  </div>
                ) : null}
              </div>

              {Array.isArray(reservation.adjustments) && reservation.adjustments.length ? (
                <div className="reservation-order-adjustments">
                  <h3>Lịch sử thay đổi số lượng</h3>
                  {(() => {
                    const chronological = [...reservation.adjustments].sort(
                      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
                    );
                    const first = chronological[0];
                    const initialQty = Number(first?.oldQuantity) || 0;
                    const initialUnit = Number(first?.oldReservedPrice) || 0;
                    const initialTotal = Math.round(initialUnit * initialQty);
                    const initialDeposit = Number(first?.oldDepositAmount) || 0;
                    return (
                      <>
                        <div className="reservation-order-adjustment-item reservation-order-adjustment-initial">
                          <strong>Ban đầu</strong>
                          <span>Số lượng: {initialQty}</span>
                          <span>Tổng tiền: {formatPrice(initialTotal)}</span>
                          <span>Tiền cọc: {formatPrice(initialDeposit)}</span>
                        </div>
                        <div className="reservation-order-adjustments-list">
                          {chronological.map((item, index) => {
                            const depositRefund = Math.max(
                              0,
                              Math.round(Number(item.oldDepositAmount) || 0) -
                                Math.round(Number(item.newDepositAmount) || 0)
                            );
                            return (
                              <div
                                key={item.id || item.createdAt}
                                className="reservation-order-adjustment-item"
                              >
                                <strong>
                                  Lần điều chỉnh
                                  {chronological.length > 1 ? ` ${index + 1}` : ''}
                                </strong>
                                <span>
                                  Số lượng: {item.oldQuantity} → {item.newQuantity}
                                </span>
                                {depositRefund > 0 ? (
                                  <span className="reservation-order-adjustment-refund">
                                    Hoàn cọc cho người mua: {formatPrice(depositRefund)}
                                  </span>
                                ) : null}
                                <time>{formatDateTimeDetail(item.createdAt)}</time>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}

              <div className="reservation-order-total-row">
                <span>Thanh toán khi nhận hàng</span>
                <strong>{formatPrice(cashDueOnPickup)}</strong>
              </div>
            </article>

            <article className="reservation-order-info-card reservation-order-party-card">
              <h2>Người mua</h2>
              <div className="reservation-party-head">
                <PartyAvatar
                  src={buyer?.avatar}
                  fallback={buyer?.fullName || buyer?.userName || 'B'}
                />
                <div className="reservation-party-head-text">
                  <div className="reservation-party-name-row">
                    <strong>{buyer?.fullName || '—'}</strong>
                  </div>
                  <span className="reservation-party-handle">
                    {buyer?.userName ? `@${buyer.userName}` : '—'}
                  </span>
                </div>
                {buyer?.id ? (
                  <Link className="detail-btn reservation-party-link" to={`/accounts/${buyer.id}`}>
                    Chi tiết
                  </Link>
                ) : null}
              </div>
              <dl className="reservation-order-fields">
                <div>
                  <dt>Email</dt>
                  <dd>{buyer?.email || '—'}</dd>
                </div>
                <div>
                  <dt>SĐT</dt>
                  <dd>{buyer?.phone || '—'}</dd>
                </div>
              </dl>
              <div className="reservation-party-stats">
                <div>
                  <strong>{buyerStats?.totalReservations || 0}</strong>
                  <span>Tổng đơn đã mua</span>
                </div>
                <div>
                  <strong>{buyerStats?.successfulReservations || 0}</strong>
                  <span>Đơn hoàn thành</span>
                </div>
                <div>
                  <strong>{buyerStats?.previousDisputes || 0}</strong>
                  <span>Đơn tranh chấp</span>
                </div>
              </div>
            </article>

            <article className="reservation-order-info-card reservation-order-party-card">
              <h2>Người bán</h2>
              <div className="reservation-party-head">
                <PartyAvatar src={sellerAvatar} fallback={sellerNick || sellerName || 'S'} />
                <div className="reservation-party-head-text">
                  <div className="reservation-party-name-row">
                    <strong>{sellerName || '—'}</strong>
                  </div>
                  <span className="reservation-party-handle">
                    {sellerNick ? `@${sellerNick}` : '—'}
                  </span>
                </div>
                {sellerAccountId ? (
                  <Link
                    className="detail-btn reservation-party-link"
                    to={`/accounts/${sellerAccountId}`}
                  >
                    Chi tiết
                  </Link>
                ) : null}
              </div>
              <dl className="reservation-order-fields">
                <div>
                  <dt>SĐT shop</dt>
                  <dd>{seller?.phone || shop?.phone || '—'}</dd>
                </div>
                <div>
                  <dt>Địa chỉ shop</dt>
                  <dd>{shopAddress || '—'}</dd>
                </div>
              </dl>
              <div className="reservation-party-stats">
                <div>
                  <strong>{sellerStats?.totalReservations || 0}</strong>
                  <span>Tổng đơn đã bán</span>
                </div>
                <div>
                  <strong>{sellerStats?.completedOrders || 0}</strong>
                  <span>Đơn hoàn thành</span>
                </div>
                <div>
                  <strong>{sellerStats?.previousDisputes || 0}</strong>
                  <span>Đơn tranh chấp</span>
                </div>
              </div>
            </article>
          </div>

          {hasDisputeSection ? (
            <section className="reservation-order-info-card reservation-order-dispute-card">
              <h2>Tranh chấp</h2>

              {singleSideDispute && !isPostDeliveryDispute ? (
                <p className="cell-sub reservation-dispute-hint">
                  Chỉ một bên đã báo cáo. Admin chỉ xử lý khi cả buyer và seller đều gửi báo cáo.
                  Nếu sau 24 giờ kể từ giờ nhận hàng vẫn chỉ một bên báo cáo, hệ thống tự hoàn
                  cọc cho bên đã báo cáo.
                </p>
              ) : null}

              {singleSideDispute && isPostDeliveryDispute ? (
                <p className="cell-sub reservation-dispute-hint">
                  Khiếu nại sau khi nhận hàng. Shop có 2 ngày để phản hồi. Admin chỉ xử lý sau khi
                  shop phản hồi hoặc hết thời hạn phản hồi.
                </p>
              ) : null}

              {canAdminProcessDispute ? (
                <p className="cell-sub reservation-dispute-hint">
                  {isPostDeliveryDispute
                    ? 'Shop đã phản hồi hoặc hết thời hạn phản hồi. Bạn có thể xử lý tranh chấp — bắt buộc nhập nội dung gửi thông báo cho buyer và seller.'
                    : 'Cả hai bên đã báo cáo. Bạn có thể xử lý tranh chấp — bắt buộc nhập nội dung gửi thông báo cho buyer và seller.'}
                </p>
              ) : null}

              {sellerResponse?.content ? (
                <div className="dispute-report-card seller">
                  <strong>Seller: Phản hồi khiếu nại</strong>
                  <p>{sellerResponse.content}</p>
                  <p className="cell-sub">
                    {reservation.sellerRespondedAt
                      ? formatDate(reservation.sellerRespondedAt)
                      : ''}
                  </p>
                  {Array.isArray(sellerResponse.images) && sellerResponse.images.length ? (
                    <div className="dispute-report-images">
                      {sellerResponse.images.map((image) => (
                        <a
                          key={image.id || image.imageUrl}
                          href={image.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={image.imageUrl} alt="seller response" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {(reservation.disputeReports || []).map((report) => {
                const isSellerReport = report.reporterSide === 'seller';
                const title = isSellerReport
                  ? report.title || report.reasonLabel || 'Báo cáo seller'
                  : report.title || report.reasonLabel || 'Báo cáo buyer';
                const content = isSellerReport
                  ? report.sellerContent || report.content
                  : report.content;
                return (
                  <div
                    key={report.id}
                    className={`dispute-report-card ${isSellerReport ? 'seller' : 'buyer'}`}
                  >
                    <strong>
                      {isSellerReport ? 'Seller' : 'Buyer'}: {title}
                    </strong>
                    <p>{content || ''}</p>
                    <p className="cell-sub">{formatDate(report.createdAt)}</p>
                    {Array.isArray(report.images) && report.images.length ? (
                      <div className="dispute-report-images">
                        {report.images.map((image) => (
                          <a
                            key={image.id || image.imageUrl}
                            href={image.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img src={image.imageUrl} alt="evidence" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : null}

          <section className="table-card reservation-audit-card">
            <h3>Nhật ký xử lý</h3>
            {auditLogs.length === 0 ? (
              <p className="cell-sub">Chưa có nhật ký xử lý.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table catalog-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Hành động</th>
                      <th>Quyết định</th>
                      <th>Ghi chú</th>
                      <th>Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.createdAt)}</td>
                        <td>{AUDIT_ACTION_LABELS[log.action] || log.action || ''}</td>
                        <td>{log.decision || ''}</td>
                        <td>{log.note || ''}</td>
                        <td>{log.adminId ? String(log.adminId).slice(-6) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {resolutionModal ? (
        <DisputeResolutionModal
          mode={resolutionModal}
          note={resolutionNote}
          loading={Boolean(actionLoading)}
          onChangeNote={setResolutionNote}
          onClose={closeResolutionModal}
          onConfirm={handleConfirmResolution}
        />
      ) : null}
    </div>
  );
}

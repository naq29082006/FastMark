import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, Eye, MessageSquareWarning } from 'lucide-react';

import {
  approveReport,
  dismissReport,
  getReportDetail,
  listReports,
} from '../api/reportApi';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminPageShell from '../components/admin/AdminPageShell';
import AdminPagination from '../components/admin/AdminPagination';
import DataTableShell from '../components/admin/DataTableShell';
import TableIconActions from '../components/ui/TableIconActions';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import PreviewableImage, { PreviewableImageGrid } from '../components/PreviewableImage';
import { formatDate } from '../utils/format';
import { keepIfSame, mergeListById } from '../utils/realtimeList';

const REPORT_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '1', label: 'Đánh giá' },
  { value: '2', label: 'Gian hàng' },
  { value: '3', label: 'Sản phẩm' },
  { value: '4', label: 'Hệ thống lỗi' },
  { value: '5', label: 'Khác' },
  { value: '6', label: 'Khiếu nại khóa tài khoản' },
  { value: '7', label: 'Khiếu nại khóa gian hàng' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'processed', label: 'Đã xử lý' },
];

const REPORT_TYPE = {
  REVIEW: 1,
  SHOP: 2,
  PRODUCT: 3,
  SYSTEM: 4,
  OTHER: 5,
  ACCOUNT_LOCK_APPEAL: 6,
  SHOP_LOCK_APPEAL: 7,
};

const SHOP_LOCK_APPEAL_TITLE_PATTERN = /khóa gian hàng|khiếu nại.*gian hàng|yêu cầu xem xét lại.*gian/i;

function isAccountLockAppealReport(detail) {
  return Number(detail?.reportType) === REPORT_TYPE.ACCOUNT_LOCK_APPEAL;
}

function isShopLockAppealReport(detail) {
  if (Number(detail?.reportType) === REPORT_TYPE.SHOP_LOCK_APPEAL) {
    return true;
  }
  if (Number(detail?.reportType) !== REPORT_TYPE.OTHER) {
    return false;
  }
  const title = String(detail?.title || detail?.reasonLabel || '');
  return Boolean(detail?.shop?.id) && SHOP_LOCK_APPEAL_TITLE_PATTERN.test(title);
}

function isLockAppealReport(detail) {
  return isAccountLockAppealReport(detail) || isShopLockAppealReport(detail);
}

const APPROVE_REPLY_TEMPLATES = [
  'Cảm ơn bạn đã báo cáo. Chúng tôi đã tiếp nhận và sẽ xem xét lại nội dung này.',
  'Cảm ơn bạn đã tố cáo. Đội ngũ FastMark đã ghi nhận và đang xử lý.',
  'Báo cáo của bạn đã được duyệt. Chúng tôi sẽ theo dõi và xử lý phù hợp.',
];

const LOCK_APPEAL_APPROVE_TEMPLATES = [
  'Khiếu nại đã được chấp nhận. Tài khoản của bạn đã được mở khóa.',
  'Chúng tôi đã xem xét và mở lại tài khoản cho bạn. Vui lòng tuân thủ quy định cộng đồng.',
];

const SHOP_LOCK_APPEAL_APPROVE_TEMPLATES = [
  'Khiếu nại đã được chấp nhận. Gian hàng của bạn đã được mở khóa.',
  'Chúng tôi đã xem xét và mở lại gian hàng cho bạn. Vui lòng tuân thủ quy định cộng đồng.',
];

const DISMISS_REPLY_TEMPLATES = [
  'Báo cáo của bạn đã bị bác bỏ. Cảm ơn bạn đã đóng góp ý kiến.',
  'Sau khi xem xét, chúng tôi chưa đủ căn cứ để xử lý tố cáo này.',
  'Tố cáo chưa đủ thông tin nên đã bị bác bỏ. Bạn có thể gửi lại với chi tiết rõ hơn.',
];

const LOCK_APPEAL_DISMISS_TEMPLATES = [
  'Khiếu nại khóa tài khoản đã bị từ chối. Tài khoản vẫn bị khóa.',
  'Sau khi xem xét, chúng tôi giữ nguyên quyết định khóa tài khoản.',
];

const SHOP_LOCK_APPEAL_DISMISS_TEMPLATES = [
  'Khiếu nại khóa gian hàng đã bị từ chối. Gian hàng vẫn bị khóa.',
  'Sau khi xem xét, chúng tôi giữ nguyên quyết định khóa gian hàng.',
];

const MEMBER_REPORT_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả (gian hàng & khiếu nại khóa)' },
  { value: '2', label: 'Gian hàng' },
  { value: '6', label: 'Khiếu nại khóa tài khoản' },
  { value: '7', label: 'Khiếu nại khóa gian hàng' },
];

const SCOPE_TO_REPORT_TYPE = {
  shop: '2',
  product: '3',
};

const REPORT_TYPE_TO_SCOPE = {
  2: 'shop',
  3: 'product',
};

function syncReportQueryParams(searchParams, patch) {
  const next = new URLSearchParams(searchParams);
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  });
  return next;
}

function statusBadgeClass(status) {
  if (status === 0) return 'badge badge-warning';
  if (status === 1) return 'badge badge-success';
  if (status === 2) return 'badge badge-neutral';
  return 'badge';
}

function reasonBadgeClass(title = '') {
  const normalized = title.toLowerCase();
  if (normalized.includes('spam') || normalized.includes('lừa')) {
    return 'badge badge-danger';
  }
  if (normalized.includes('xúc phạm') || normalized.includes('thô tục')) {
    return 'badge badge-warning';
  }
  if (normalized.includes('sai sự thật') || normalized.includes('giả mạo')) {
    return 'badge badge-info';
  }
  return 'badge badge-danger';
}

function typeBadgeClass(reportType) {
  if (reportType === REPORT_TYPE.REVIEW) return 'badge badge-info';
  if (reportType === REPORT_TYPE.SHOP) return 'badge badge-warning';
  if (reportType === REPORT_TYPE.PRODUCT) return 'badge badge-danger';
  if (reportType === REPORT_TYPE.SYSTEM) return 'badge badge-danger';
  if (reportType === REPORT_TYPE.ACCOUNT_LOCK_APPEAL) return 'badge badge-warning';
  if (reportType === REPORT_TYPE.SHOP_LOCK_APPEAL) return 'badge badge-warning';
  if (reportType === REPORT_TYPE.OTHER) return 'badge badge-neutral';
  return 'badge badge-neutral';
}

function getReportTargetLabel(item) {
  const productName = item?.targetProductName || item?.target_product_name || '';
  const shopName = item?.targetShopName || item?.target_shop_name || '';

  if (productName) {
    return `Sản phẩm: ${productName}`;
  }
  if (shopName) {
    return `Gian hàng: ${shopName}`;
  }
  return '';
}

function formatTargetUserLine(user) {
  if (!user) return '';
  const name = user.fullName || user.userName || '';
  if (!name && !user.email) return '';
  if (user.userName && user.fullName) {
    return `${user.fullName} (@${user.userName})`;
  }
  return name || user.email || '';
}

function getAvatarInitial(person) {
  const raw = String(person?.fullName || person?.userName || person?.name || '?').trim();
  return raw.charAt(0).toUpperCase() || '?';
}

function PartyAvatar({ person, name }) {
  const initial = getAvatarInitial(person || { fullName: name });
  return (
    <PreviewableImage
      src={person?.avatar || ''}
      alt={person?.fullName || person?.userName || name || ''}
      width={48}
      height={48}
      shape="rounded"
      className="report-party-avatar"
      style={{ borderRadius: 14 }}
      fallbackLetter={initial}
      fallbackClassName="report-party-avatar placeholder"
    />
  );
}

function getReportedAccountId(detail) {
  if (detail?.targetUser?.id) {
    return String(detail.targetUser.id);
  }
  if (detail?.shop?.userId) {
    return String(detail.shop.userId);
  }
  return '';
}

function getReportedSubjectFieldLabel(reportType) {
  switch (reportType) {
    case REPORT_TYPE.SHOP:
      return 'Gian hàng bị báo cáo';
    case REPORT_TYPE.PRODUCT:
      return 'Sản phẩm bị báo cáo';
    case REPORT_TYPE.REVIEW:
      return 'Đánh giá bị báo cáo';
    case REPORT_TYPE.SYSTEM:
      return 'Đối tượng bị báo cáo';
    case REPORT_TYPE.OTHER:
      return 'Đối tượng bị báo cáo';
    case REPORT_TYPE.ACCOUNT_LOCK_APPEAL:
      return 'Tài khoản khiếu nại';
    case REPORT_TYPE.SHOP_LOCK_APPEAL:
      return 'Gian hàng khiếu nại';
    default:
      return 'Đối tượng bị báo cáo';
  }
}

function getReportedSubjectValue(detail) {
  const reportType = detail?.reportType;

  if (reportType === REPORT_TYPE.SHOP) {
    return (
      detail?.shop?.name ||
      detail?.targetShopName ||
      detail?.target_shop_name ||
      detail?.targetUser?.fullName ||
      detail?.targetUser?.userName ||
      ''
    );
  }

  if (reportType === REPORT_TYPE.PRODUCT) {
    return detail?.product?.name || detail?.targetProductName || detail?.target_product_name || '';
  }

  if (reportType === REPORT_TYPE.REVIEW) {
    const review = detail?.review;
    if (review) {
      const summary = review.comment
        ? `${review.userName || 'Khách hàng'} • ★ ${review.rating}/5 — ${review.comment}`
        : `${review.userName || 'Khách hàng'} • ★ ${review.rating}/5`;
      return summary;
    }
    return detail?.content || '';
  }

  if (reportType === REPORT_TYPE.ACCOUNT_LOCK_APPEAL) {
    return (
      formatTargetUserLine(detail?.reporter) ||
      detail?.reporter?.fullName ||
      detail?.reporter?.userName ||
      ''
    );
  }

  if (reportType === REPORT_TYPE.SHOP_LOCK_APPEAL || isShopLockAppealReport(detail)) {
    return (
      detail?.shop?.name ||
      detail?.targetShopName ||
      detail?.target_shop_name ||
      formatTargetUserLine(detail?.reporter) ||
      ''
    );
  }

  return detail?.targetSubjectLabel || getReportTargetLabel(detail) || '';
}

function getReportedOwnerLines(detail) {
  const lines = [];
  const targetUser = detail?.targetUser;
  const ownerLine = formatTargetUserLine(targetUser);
  const shopBio = String(detail?.shop?.description || '').trim();

  if (detail?.reportType === REPORT_TYPE.SHOP) {
    if (shopBio) {
      lines.push(`Bio: ${shopBio}`);
    }
    if (targetUser?.userName) {
      lines.push(`@${targetUser.userName}`);
    }
    if (targetUser?.email) {
      lines.push(targetUser.email);
    }
    return lines;
  }

  if (detail?.reportType === REPORT_TYPE.PRODUCT) {
    const shopName =
      detail?.shop?.name ||
      detail?.targetShopName ||
      detail?.target_shop_name ||
      targetUser?.fullName ||
      targetUser?.userName ||
      '';
    if (shopName) {
      lines.push(`Gian hàng: ${shopName}`);
    }
    if (shopBio) {
      lines.push(`Bio: ${shopBio}`);
    }
    if (ownerLine) {
      lines.push(`Chủ gian hàng: ${ownerLine}`);
    }
    if (targetUser?.email) {
      lines.push(targetUser.email);
    }
    return lines;
  }

  if (shouldShowRelatedTargetField(detail?.reportType) && getRelatedTargetValue(detail)) {
    lines.push(getRelatedTargetValue(detail));
  }

  return lines;
}

function getRelatedTargetValue(detail) {
  const productName =
    detail?.targetProductName || detail?.target_product_name || detail?.product?.name || '';
  const shopName = detail?.targetShopName || detail?.target_shop_name || detail?.shop?.name || '';

  if (productName && shopName) {
    return `${productName} • ${shopName}`;
  }
  if (productName) {
    return productName;
  }
  if (shopName) {
    return shopName;
  }
  return '';
}

function shouldShowRelatedTargetField(reportType) {
  return reportType === REPORT_TYPE.REVIEW;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index}>
          <td><div className="skeleton skeleton-line" /></td>
          <td><div className="skeleton skeleton-line" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
          <td><div className="skeleton skeleton-line short" /></td>
        </tr>
      ))}
    </>
  );
}

function EvidenceImagesSection({ images }) {
  const urls = (images || [])
    .map((image) => resolveMediaUrl(image?.url))
    .filter(Boolean);

  return (
    <div className="evidence-section">
      <div className="evidence-section-header">
        <h4>Hình ảnh bằng chứng</h4>
        {urls.length > 0 ? <span className="badge badge-info">{urls.length} ảnh</span> : null}
      </div>
      {urls.length > 0 ? (
        <PreviewableImageGrid
          items={urls}
          width={120}
          height={120}
          shape="rounded"
          className="evidence-thumbnail-grid previewable-image-grid"
          getKey={(url, index) => images[index]?.id || `${url}-${index}`}
          getAlt={(_, index) => `Bằng chứng ${index + 1}`}
        />
      ) : (
        <div className="evidence-empty-box">Không có hình ảnh bằng chứng</div>
      )}
    </div>
  );
}

function ReportDetailModal({
  detail,
  loading,
  actionLoading,
  onClose,
  onDismiss,
  onApprove,
  showApproveOptions,
  showDismissOptions,
  replyMessage,
  onChangeReplyMessage,
  onPickReplyTemplate,
  onConfirmApprove,
  onConfirmDismiss,
  onCancelAction,
}) {
  const isPending = Number(detail?.status) === 0;
  const isAccountLockAppeal = isAccountLockAppealReport(detail);
  const isShopLockAppeal = isShopLockAppealReport(detail);
  const isLockAppeal = isAccountLockAppeal || isShopLockAppeal;
  const review = detail?.review;
  const shop = detail?.shop;
  const product = detail?.product;
  const evidenceImages = detail?.evidenceImages || [];
  const replyTemplates = showDismissOptions
    ? isAccountLockAppeal
      ? LOCK_APPEAL_DISMISS_TEMPLATES
      : isShopLockAppeal
        ? SHOP_LOCK_APPEAL_DISMISS_TEMPLATES
        : DISMISS_REPLY_TEMPLATES
    : isAccountLockAppeal
      ? LOCK_APPEAL_APPROVE_TEMPLATES
      : isShopLockAppeal
        ? SHOP_LOCK_APPEAL_APPROVE_TEMPLATES
        : APPROVE_REPLY_TEMPLATES;
  const composingReply = showApproveOptions || showDismissOptions;

  return (
    <div className="dialog-overlay" role="presentation" onClick={() => !actionLoading && onClose()}>
      <div
        className="dialog-card dialog-card-wide"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3>Chi tiết báo cáo vi phạm</h3>
            <p>Mã báo cáo: {detail?.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" disabled={actionLoading} onClick={onClose}>
            Đóng
          </button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : (
          <div className="report-modal-body">
            <div className="report-modal-grid">
              <section className="modal-section report-info-section">
                <div className="report-chip-row">
                  <span className={typeBadgeClass(detail?.reportType)}>
                    {detail?.reportTypeLabel || '—'}
                  </span>
                  <span className={statusBadgeClass(detail?.status)}>
                    {detail?.statusLabel || '—'}
                  </span>
                </div>

                <div className="report-party-grid">
                  <article className="report-party-card">
                    <span className="report-party-label">Người báo cáo</span>
                    <div className="report-party-head">
                      <PartyAvatar person={detail?.reporter} />
                      <div className="report-party-head-copy">
                        <strong className="report-party-name">
                          {detail?.reporter?.fullName || detail?.reporter?.userName || '—'}
                        </strong>
                        {detail?.reporter?.userName ? (
                          <span className="report-party-meta">@{detail.reporter.userName}</span>
                        ) : null}
                        {detail?.reporter?.email ? (
                          <span className="report-party-meta">{detail.reporter.email}</span>
                        ) : null}
                      </div>
                    </div>
                    <span className="report-party-meta">
                      Gửi lúc {formatDate(detail?.createdAt) || '—'}
                    </span>
                    {detail?.reporter?.id ? (
                      <Link
                        className="detail-btn report-party-link"
                        to={`/accounts/${detail.reporter.id}`}
                        onClick={onClose}
                      >
                        Xem chi tiết tài khoản
                      </Link>
                    ) : null}
                  </article>

                  <article className="report-party-card">
                    <span className="report-party-label">
                      {getReportedSubjectFieldLabel(detail?.reportType)}
                    </span>
                    <div className="report-party-head">
                      <PartyAvatar
                        person={
                          detail?.reportType === REPORT_TYPE.SHOP
                            ? detail?.targetUser
                            : detail?.targetUser || detail?.shop
                        }
                        name={getReportedSubjectValue(detail)}
                      />
                      <div className="report-party-head-copy">
                        <strong className="report-party-name">
                          {getReportedSubjectValue(detail) || 'Chưa gắn đối tượng'}
                        </strong>
                        {!getReportedSubjectValue(detail) ? (
                          <span className="report-party-meta">
                            Báo cáo lúc gửi chưa lưu gian hàng / user.
                          </span>
                        ) : null}
                        {getReportedOwnerLines(detail).map((line) => (
                          <span key={line} className="report-party-meta">
                            {line}
                          </span>
                        ))}
                      </div>
                    </div>
                    {detail?.reasonLabel ? (
                      <span className={`report-party-reason ${reasonBadgeClass(detail.reasonLabel)}`}>
                        {detail.reasonLabel}
                      </span>
                    ) : null}
                    {getReportedAccountId(detail) ? (
                      <Link
                        className="detail-btn report-party-link"
                        to={`/accounts/${getReportedAccountId(detail)}`}
                        onClick={onClose}
                      >
                        Xem chi tiết tài khoản
                      </Link>
                    ) : null}
                  </article>
                </div>

                <div className="report-content-block">
                  <h4>Nội dung báo cáo</h4>
                  <p className="report-content-text">{detail?.content || 'Không có nội dung.'}</p>
                </div>

                <div className="report-evidence-block">
                  <EvidenceImagesSection images={evidenceImages} />
                </div>

                {detail?.xuLyBoi || detail?.tgXuLy ? (
                  <dl className="detail-list report-process-meta">
                    {detail?.xuLyBoi ? (
                      <div>
                        <dt>Người xử lý</dt>
                        <dd>{detail.xuLyBoi.fullName || detail.xuLyBoi.userName || ''}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Thời gian xử lý</dt>
                      <dd>{formatDate(detail?.tgXuLy)}</dd>
                    </div>
                  </dl>
                ) : null}
              </section>

              <section className="modal-section modal-section-actions">
                <h4>{isLockAppeal ? 'Xử lý khiếu nại khóa' : 'Phản hồi người tố cáo'}</h4>
                {!isPending ? (
                  <div className="empty-card">Báo cáo này đã được xử lý trước đó.</div>
                ) : composingReply ? (
                  <div className="action-option-group">
                    <p>
                      {showDismissOptions
                        ? isLockAppeal
                          ? 'Chọn hoặc nhập thông báo gửi người khiếu nại khi bác bỏ.'
                          : 'Chọn hoặc nhập nội dung thông báo khi bác bỏ.'
                        : isLockAppeal
                          ? 'Chọn hoặc nhập thông báo gửi người khiếu nại khi mở lại.'
                          : 'Chọn hoặc nhập nội dung thông báo khi duyệt.'}
                    </p>

                    <label className="report-reply-field">
                      <strong>{isLockAppeal ? 'Thông báo gửi người khiếu nại' : 'Thông báo gửi người tố cáo'}</strong>
                      <div className="report-reply-templates">
                        {replyTemplates.map((template, index) => (
                          <button
                            key={`tpl-${index}`}
                            type="button"
                            className="ghost-btn report-reply-template"
                            onClick={() => onPickReplyTemplate(template)}
                          >
                            {template}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={4}
                        value={replyMessage}
                        onChange={(event) => onChangeReplyMessage(event.target.value)}
                        placeholder="Nhập nội dung thông báo..."
                      />
                    </label>

                    <div className="report-action-row">
                      <button
                        type="button"
                        className="report-btn report-btn-ghost"
                        disabled={actionLoading}
                        onClick={onCancelAction}
                      >
                        Quay lại
                      </button>
                      {showDismissOptions ? (
                        <button
                          type="button"
                          className="report-btn report-btn-reject"
                          disabled={actionLoading || !String(replyMessage || '').trim()}
                          onClick={onConfirmDismiss}
                        >
                          {actionLoading ? 'Đang xử lý...' : 'Xác nhận bác bỏ'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="report-btn report-btn-approve"
                          disabled={actionLoading || !String(replyMessage || '').trim()}
                          onClick={onConfirmApprove}
                        >
                          {actionLoading
                            ? 'Đang xử lý...'
                            : isLockAppeal
                              ? 'Xác nhận mở lại'
                              : 'Xác nhận duyệt'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="report-action-hint">
                      {isAccountLockAppeal
                        ? 'Bác bỏ sẽ giữ khóa tài khoản. Mở lại sẽ khôi phục quyền truy cập cho người khiếu nại.'
                        : isShopLockAppeal
                          ? 'Bác bỏ sẽ giữ khóa gian hàng. Mở lại sẽ khôi phục hoạt động gian hàng.'
                          : 'Duyệt hoặc bác bỏ. Hệ thống chỉ gửi thông báo phản hồi cho người tố cáo.'}
                    </p>
                    <div className="report-action-row">
                      <button
                        type="button"
                        className="report-btn report-btn-reject"
                        disabled={actionLoading}
                        onClick={onDismiss}
                      >
                        Bác bỏ
                      </button>
                      <button
                        type="button"
                        className="report-btn report-btn-approve"
                        disabled={actionLoading}
                        onClick={onApprove}
                      >
                        {isLockAppeal ? 'Mở lại' : 'Duyệt'}
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>

            {shop && detail?.reportType !== REPORT_TYPE.SHOP ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin gian hàng liên quan</h4>
                <dl className="detail-list">
                  <div>
                    <dt>Tên gian hàng</dt>
                    <dd>{shop.name || ''}</dd>
                  </div>
                  <div>
                    <dt>Địa chỉ</dt>
                    <dd>{shop.addressHeThong || shop.systemAddress || shop.address || ''}</dd>
                  </div>
                  <div>
                    <dt>Số điện thoại</dt>
                    <dd>{shop.phone || ''}</dd>
                  </div>
                </dl>
              </section>
            ) : null}

            {product && detail?.reportType === REPORT_TYPE.PRODUCT ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin bổ sung sản phẩm</h4>
                <dl className="detail-list">
                  {product.shopName ? (
                    <div>
                      <dt>Gian hàng</dt>
                      <dd>{product.shopName}</dd>
                    </div>
                  ) : null}
                  {product.description ? (
                    <div>
                      <dt>Mô tả</dt>
                      <dd>{product.description}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {product && detail?.reportType !== REPORT_TYPE.PRODUCT ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin sản phẩm liên quan</h4>
                <dl className="detail-list">
                  <div>
                    <dt>Tên sản phẩm</dt>
                    <dd>{product.name || ''}</dd>
                  </div>
                  {product.shopName ? (
                    <div>
                      <dt>Gian hàng</dt>
                      <dd>{product.shopName}</dd>
                    </div>
                  ) : null}
                  {product.description ? (
                    <div>
                      <dt>Mô tả</dt>
                      <dd>{product.description}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {review ? (
              <section className="modal-section modal-section-full">
                <h4>Đánh giá bị tố cáo</h4>
                <article className="report-item">
                  <p>
                    <strong>{review.userName}</strong> • ★ {review.rating}/5
                  </p>
                  <p>{review.comment || 'Không có nội dung đánh giá.'}</p>
                  <span className="account-secondary">{formatDate(review.createdAt)}</span>
                </article>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportManagement() {
  const { getIdToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const scopeFromUrl = searchParams.get('scope') || '';
  const statusFromUrl = searchParams.get('status') || '';
  const productIdFromUrl = searchParams.get('productId') || '';

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();
  const {
    from: dateFrom,
    to: dateTo,
    preset: datePreset,
    applyRange: applyDateRange,
    resetRange: resetDateRange,
    queryParams: dateQueryParams,
  } = useAdminDateFilter();
  const [reportType, setReportType] = useState(SCOPE_TO_REPORT_TYPE[scopeFromUrl] || '');
  const [statusFilter, setStatusFilter] = useState(
    statusFromUrl === '1' ? 'processed' : 'pending',
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [dataMeta, setDataMeta] = useState(null);

  const [selectedReportId, setSelectedReportId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveOptions, setShowApproveOptions] = useState(false);
  const [showDismissOptions, setShowDismissOptions] = useState(false);
  const [replyMessage, setReplyMessage] = useState(APPROVE_REPLY_TEMPLATES[0]);

  const statusParam = statusFilter === 'pending' ? '0' : 'processed';

  const pageMeta = useMemo(
    () => ({
      title: 'Xử lý báo cáo',
      description: productIdFromUrl
        ? 'Báo cáo liên quan đến sản phẩm đang xem.'
        : 'Xử lý báo cáo gian hàng, người dùng, sản phẩm, đánh giá và khiếu nại khóa tài khoản. Tranh chấp đơn hàng xử lý tại Quản lý đơn hàng.',
    }),
    [productIdFromUrl],
  );

  useEffect(() => {
    if (scopeFromUrl !== 'members') {
      setReportType(SCOPE_TO_REPORT_TYPE[scopeFromUrl] || '');
    }
    if (statusFromUrl === '1') {
      setStatusFilter('processed');
    } else if (statusFromUrl === '0') {
      setStatusFilter('pending');
    }
    resetDateRange();
    setPage(1);
  }, [scopeFromUrl, statusFromUrl, resetDateRange]);

  const reportTypeOptions = useMemo(() => {
    if (scopeFromUrl === 'members') {
      return MEMBER_REPORT_TYPE_OPTIONS;
    }
    if (scopeFromUrl === 'product') {
      return REPORT_TYPE_OPTIONS.filter((option) => !option.value || option.value === '3');
    }
    return REPORT_TYPE_OPTIONS;
  }, [scopeFromUrl]);

  const loadItems = useCallback(async ({ silent = false } = {}) => {
    // silent = đồng bộ realtime: không bật loading, chỉ dòng nào đổi mới render lại.
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const token = await getIdToken();
      const payload = await listReports(token, {
        search,
        reportType,
        status: statusParam,
        scope: scopeFromUrl === 'members' ? 'members' : undefined,
        productId: productIdFromUrl || undefined,
        page,
        limit,
        ...dateQueryParams,
      });

      setItems((current) => mergeListById(current, payload.data?.items || []));
      setPagination((current) =>
        keepIfSame(current, payload.data?.pagination || {
          page: 1,
          limit: DEFAULT_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        }),
      );
      setDataMeta((current) => keepIfSame(current, payload.data?.meta || null));
    } catch (loadError) {
      if (silent) {
        return;
      }
      setError(loadError.message || 'Không tải được danh sách báo cáo.');
      setItems([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [getIdToken, limit, page, productIdFromUrl, reportType, scopeFromUrl, search, statusParam, dateFrom, dateTo, dateQueryParams]);

  const loadDetail = useCallback(
    async (reportId) => {
      setDetail(null);
      setDetailLoading(true);
      setError('');

      try {
        const token = await getIdToken();
        const payload = await getReportDetail(token, reportId);
        setDetail(payload.data?.report || null);
      } catch (loadError) {
        setError(loadError.message || 'Không tải được chi tiết báo cáo.');
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [getIdToken]
  );

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useAdminRealtimeRefresh('report', () => loadItems({ silent: true }), {
    coalesceMs: REALTIME_COALESCE_MS,
  });

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setSnackbar(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [snackbar]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  function handleStatusFilterChange(value) {
    setStatusFilter(value);
    setPage(1);
    setShowApproveOptions(false);
    setShowDismissOptions(false);
    const patch = {
      status: value === 'processed' ? '1' : value === 'pending' ? '0' : null,
    };
    if (scopeFromUrl === 'members') {
      patch.scope = 'members';
    } else if (scopeFromUrl === 'product') {
      patch.scope = 'product';
    }
    setSearchParams(syncReportQueryParams(searchParams, patch), { replace: true });
  }

  function handleReportTypeChange(value) {
    setReportType(value);
    setPage(1);
    if (scopeFromUrl === 'members') {
      return;
    }
    setSearchParams(
      syncReportQueryParams(searchParams, {
        scope: REPORT_TYPE_TO_SCOPE[value] || null,
      }),
      { replace: true },
    );
  }

  const pendingCount = items.filter((item) => item.status === 0).length;
  const processedCount = items.filter((item) => item.status !== 0).length;

  function openDetail(reportId) {
    setSelectedReportId(reportId);
    setShowApproveOptions(false);
    setShowDismissOptions(false);
    setReplyMessage(APPROVE_REPLY_TEMPLATES[0]);
    loadDetail(reportId);
  }

  function closeDetail() {
    if (actionLoading) {
      return;
    }
    setSelectedReportId('');
    setDetail(null);
    setShowApproveOptions(false);
    setShowDismissOptions(false);
  }

  async function refreshAfterAction(message, updatedReport) {
    setSnackbar(message);
    setDetail(updatedReport);
    setShowApproveOptions(false);
    setShowDismissOptions(false);
    await loadItems();
  }

  function handleDismissClick() {
    const isAccountLockAppeal = isAccountLockAppealReport(detail);
    const isShopLockAppeal = isShopLockAppealReport(detail);
    setShowDismissOptions(true);
    setShowApproveOptions(false);
    setReplyMessage(
      isAccountLockAppeal
        ? LOCK_APPEAL_DISMISS_TEMPLATES[0]
        : isShopLockAppeal
          ? SHOP_LOCK_APPEAL_DISMISS_TEMPLATES[0]
          : DISMISS_REPLY_TEMPLATES[0]
    );
  }

  async function handleConfirmDismiss() {
    if (!selectedReportId) {
      return;
    }
    const message = String(replyMessage || '').trim();
    if (!message) {
      setError('Vui lòng nhập thông báo gửi người tố cáo.');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await dismissReport(token, selectedReportId, message);
      await refreshAfterAction(
        payload.message ||
          (isAccountLockAppealReport(detail)
            ? 'Đã bác bỏ khiếu nại khóa tài khoản.'
            : isShopLockAppealReport(detail)
              ? 'Đã bác bỏ khiếu nại khóa gian hàng.'
              : 'Đã bác bỏ báo cáo vi phạm.'),
        payload.data?.report
      );
    } catch (actionError) {
      setError(actionError.message || 'Không bác bỏ được báo cáo.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleApproveClick() {
    const isAccountLockAppeal = isAccountLockAppealReport(detail);
    const isShopLockAppeal = isShopLockAppealReport(detail);
    setShowApproveOptions(true);
    setShowDismissOptions(false);
    setReplyMessage(
      isAccountLockAppeal
        ? LOCK_APPEAL_APPROVE_TEMPLATES[0]
        : isShopLockAppeal
          ? SHOP_LOCK_APPEAL_APPROVE_TEMPLATES[0]
          : APPROVE_REPLY_TEMPLATES[0]
    );
  }

  async function handleConfirmApprove() {
    if (!selectedReportId) {
      return;
    }
    const message = String(replyMessage || '').trim();
    if (!message) {
      setError('Vui lòng nhập thông báo gửi người tố cáo.');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await approveReport(token, selectedReportId, 'resolve', message);
      await refreshAfterAction(
        payload.message ||
          (isAccountLockAppealReport(detail)
            ? 'Đã mở lại tài khoản.'
            : isShopLockAppealReport(detail)
              ? 'Đã mở lại gian hàng.'
              : 'Đã duyệt vi phạm thành công.'),
        payload.data?.report
      );
    } catch (actionError) {
      setError(actionError.message || 'Không duyệt được báo cáo.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AdminPageShell
      icon={MessageSquareWarning}
      title={pageMeta.title}
      description={pageMeta.description}
      stats={[
        { label: 'Tổng báo cáo', value: loading ? '…' : pagination.total, icon: MessageSquareWarning, tone: 'green' },
        { label: 'Chờ xử lý (trang)', value: loading ? '…' : pendingCount, icon: Clock, tone: 'amber' },
        { label: 'Đã xử lý (trang)', value: loading ? '…' : processedCount, icon: CheckCircle, tone: 'blue' },
      ]}
    >
      {snackbar ? <p className="snackbar">{snackbar}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <DataTableShell
        title={statusFilter === 'pending' ? 'Báo cáo chờ xử lý' : 'Báo cáo đã xử lý'}
        filters={
          <AdminFilterPanel
            layout="inline"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Nội dung, lý do, tên người báo cáo..."
          >
            <label>
              Trạng thái
              <select value={statusFilter} onChange={(event) => handleStatusFilterChange(event.target.value)}>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Loại vi phạm
              <select value={reportType} onChange={(event) => handleReportTypeChange(event.target.value)}>
                {reportTypeOptions.map((option) => (
                  <option key={option.value || 'all-type'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <AdminDateFilter
              from={dateFrom}
              to={dateTo}
              preset={datePreset}
              onApply={(range) => applyDateRange(range, () => setPage(1))}
            />
          </AdminFilterPanel>
        }
        pagination={
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            label="báo cáo"
            limit={limit}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            loading={loading}
            onPageChange={setPage}
          />
        }
      >
        <table className="account-table admin-data-table">
          <thead>
            <tr>
              <th>Nội dung vi phạm</th>
              <th>Loại</th>
              <th>Lý do vi phạm</th>
              <th>Người báo cáo</th>
              <th>Trạng thái</th>
              <th>Thời gian</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows /> : null}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  {statusFilter === 'pending'
                    ? 'Không có báo cáo chờ xử lý.'
                    : 'Không có báo cáo đã xử lý.'}
                </td>
              </tr>
            ) : null}
            {!loading
              ? items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="account-primary">{item.content || item.title || ''}</div>
                      {getReportTargetLabel(item) ? (
                        <div className="report-target-meta">{getReportTargetLabel(item)}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={typeBadgeClass(item.reportType)}>{item.reportTypeLabel}</span>
                    </td>
                    <td>
                      <span className={reasonBadgeClass(item.reasonLabel)}>{item.reasonLabel}</span>
                    </td>
                    <td>
                      <div>{item.reporter?.fullName || item.reporter?.userName || ''}</div>
                      <div className="account-secondary">{item.reporter?.email || ''}</div>
                    </td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>{item.statusLabel}</span>
                    </td>
                    <td>
                      <div className="account-secondary">Gửi: {formatDate(item.createdAt)}</div>
                      <div className="account-secondary">Xử lý: {formatDate(item.tgXuLy)}</div>
                    </td>
                    <td>
                      <TableIconActions
                        actions={[
                          {
                            icon: Eye,
                            label: 'Chi tiết báo cáo',
                            onClick: () => openDetail(item.id),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </DataTableShell>

      {selectedReportId ? (
        <ReportDetailModal
          detail={detail}
          loading={detailLoading}
          actionLoading={actionLoading}
          onClose={closeDetail}
          onDismiss={handleDismissClick}
          onApprove={handleApproveClick}
          showApproveOptions={showApproveOptions}
          showDismissOptions={showDismissOptions}
          replyMessage={replyMessage}
          onChangeReplyMessage={setReplyMessage}
          onPickReplyTemplate={setReplyMessage}
          onConfirmApprove={handleConfirmApprove}
          onConfirmDismiss={handleConfirmDismiss}
          onCancelAction={() => {
            setShowApproveOptions(false);
            setShowDismissOptions(false);
          }}
        />
      ) : null}
    </AdminPageShell>
  );
}

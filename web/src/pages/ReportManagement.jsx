import { useCallback, useEffect, useState } from 'react';

import {
  approveReport,
  dismissReport,
  getReportDetail,
  listReports,
} from '../api/reportApi';
import { useAuth } from '../context/AuthContext';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const REPORT_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '1', label: 'Đánh giá' },
  { value: '2', label: 'Người dùng' },
  { value: '3', label: 'Gian hàng' },
  { value: '4', label: 'Sản phẩm' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '0', label: 'Chờ xử lý' },
  { value: '1', label: 'Đã xử lý' },
  { value: '2', label: 'Đã bác bỏ' },
];

const REVIEW_ACTION_OPTIONS = [
  {
    value: 'hide',
    label: 'Ẩn đánh giá',
    description: 'Đánh giá sẽ không hiển thị công khai nhưng vẫn lưu trong hệ thống.',
  },
  {
    value: 'delete',
    label: 'Xóa mềm đánh giá',
    description: 'Đánh giá được đánh dấu xóa mềm và loại khỏi danh sách hiển thị.',
  },
];

const USER_ACTION_OPTIONS = [
  {
    value: 'warn',
    label: 'Cảnh cáo người dùng',
    description: 'Gửi thông báo cảnh cáo in-app tới tài khoản bị tố cáo.',
  },
  {
    value: 'block',
    label: 'Khóa tài khoản người dùng',
    description: 'Cập nhật trạng thái tài khoản bị tố cáo thành đã khóa trong hệ thống.',
  },
];

const SHOP_ACTION_OPTIONS = [
  {
    value: 'warn_limit',
    label: 'Cảnh cáo & Giới hạn hiển thị',
    description:
      'Gửi thông báo cảnh cáo tới chủ shop, đồng thời tạm thời giảm hiển thị của gian hàng.',
  },
  {
    value: 'suspend_7_days',
    label: 'Tạm đình chỉ hoạt động (7 ngày)',
    description:
      'Tạm khóa quyền bán hàng và ẩn toàn bộ sản phẩm hiện có của gian hàng để điều tra.',
  },
  {
    value: 'permanent_close',
    label: 'Khóa gian hàng vĩnh viễn',
    description:
      'Đóng cửa gian hàng vĩnh viễn, ẩn toàn bộ sản phẩm và khóa tài khoản chủ shop.',
  },
];

const REPORT_TYPE = {
  REVIEW: 1,
  USER: 2,
  SHOP: 3,
  PRODUCT: 4,
};

function isUserLikeReportType(reportType) {
  return [REPORT_TYPE.USER, REPORT_TYPE.SHOP, REPORT_TYPE.PRODUCT].includes(reportType);
}

function getApproveActionOptions(reportType) {
  if (reportType === REPORT_TYPE.SHOP) {
    return SHOP_ACTION_OPTIONS;
  }
  return isUserLikeReportType(reportType) ? USER_ACTION_OPTIONS : REVIEW_ACTION_OPTIONS;
}

function getDefaultApproveAction(reportType) {
  if (reportType === REPORT_TYPE.SHOP) {
    return 'warn_limit';
  }
  return isUserLikeReportType(reportType) ? 'warn' : 'hide';
}

function getApprovePrompt(reportType) {
  if (reportType === REPORT_TYPE.SHOP) {
    return 'Chọn phương án xử lý gian hàng vi phạm:';
  }
  return isUserLikeReportType(reportType)
    ? 'Chọn phương án xử lý người dùng vi phạm:'
    : 'Chọn phương án xử lý đánh giá vi phạm:';
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('vi-VN');
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

function getReportedSubjectFieldLabel(reportType) {
  switch (reportType) {
    case REPORT_TYPE.SHOP:
      return 'Gian hàng bị báo cáo';
    case REPORT_TYPE.USER:
      return 'Người dùng bị báo cáo';
    case REPORT_TYPE.PRODUCT:
      return 'Sản phẩm bị báo cáo';
    case REPORT_TYPE.REVIEW:
      return 'Đánh giá bị báo cáo';
    default:
      return 'Đối tượng bị báo cáo';
  }
}

function getReportedSubjectValue(detail) {
  const reportType = detail?.reportType;

  if (reportType === REPORT_TYPE.SHOP) {
    return detail?.shop?.name || detail?.targetShopName || detail?.target_shop_name || '—';
  }

  if (reportType === REPORT_TYPE.USER) {
    const user = detail?.targetUser;
    if (user?.fullName || user?.userName) {
      const name = user.fullName || user.userName;
      return user.email ? `${name} (${user.email})` : name;
    }
    return '—';
  }

  if (reportType === REPORT_TYPE.PRODUCT) {
    return detail?.product?.name || detail?.targetProductName || detail?.target_product_name || '—';
  }

  if (reportType === REPORT_TYPE.REVIEW) {
    const review = detail?.review;
    if (review) {
      const summary = review.comment
        ? `${review.userName || 'Khách hàng'} • ★ ${review.rating}/5 — ${review.comment}`
        : `${review.userName || 'Khách hàng'} • ★ ${review.rating}/5`;
      return summary;
    }
    return detail?.content || '—';
  }

  return detail?.targetSubjectLabel || getReportTargetLabel(detail) || '—';
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
  return '—';
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

function EvidenceImagesSection({ images, onPreview }) {
  return (
    <div className="evidence-section">
      <div className="evidence-section-header">
        <h4>Hình ảnh bằng chứng</h4>
        {images.length > 0 ? <span className="badge badge-info">{images.length} ảnh</span> : null}
      </div>
      {images.length > 0 ? (
        <div className="evidence-thumbnail-grid">
          {images.map((image, index) => {
            const imageSrc = resolveMediaUrl(image.url);
            return (
            <button
              key={image.id}
              type="button"
              className="evidence-thumbnail"
              onClick={() => onPreview(imageSrc, index)}
              aria-label={`Xem bằng chứng ${index + 1}`}
            >
              <img src={imageSrc} alt={`Bằng chứng ${index + 1}`} loading="lazy" />
            </button>
            );
          })}
        </div>
      ) : (
        <div className="evidence-empty-box">Không có hình ảnh bằng chứng</div>
      )}
    </div>
  );
}

function ImagePreviewModal({ imageUrl, onClose }) {
  if (!imageUrl) {
    return null;
  }

  return (
    <div className="image-preview-overlay" role="presentation" onClick={onClose}>
      <div className="image-preview-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="ghost-btn image-preview-close" onClick={onClose}>
          Đóng
        </button>
        <img src={imageUrl} alt="Hình ảnh bằng chứng phóng to" className="image-preview-full" />
      </div>
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
  selectedAction,
  onSelectAction,
  onConfirmApprove,
  onCancelApprove,
}) {
  const isPending = detail?.status === 0;
  const review = detail?.review;
  const shop = detail?.shop;
  const product = detail?.product;
  const evidenceImages = detail?.evidenceImages || [];
  const approveActionOptions = getApproveActionOptions(detail?.reportType);
  const approvePrompt = getApprovePrompt(detail?.reportType);
  const [previewImage, setPreviewImage] = useState('');

  function handlePreview(url) {
    setPreviewImage(url);
  }

  function closePreview() {
    setPreviewImage('');
  }

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
            <p>Mã báo cáo: {detail?.id || '—'}</p>
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
              <section className="modal-section">
                <h4>Thông tin vi phạm</h4>
                <div className="badge-row">
                  <span className={typeBadgeClass(detail?.reportType)}>{detail?.reportTypeLabel}</span>
                  <span className={reasonBadgeClass(detail?.reasonLabel)}>{detail?.reasonLabel}</span>
                  <span className={statusBadgeClass(detail?.status)}>{detail?.statusLabel}</span>
                </div>

                <dl className="detail-list">
                  <div><dt>Loại báo cáo</dt><dd>{detail?.reportTypeLabel || '—'}</dd></div>
                  <div><dt>Nội dung</dt><dd>{detail?.content || '—'}</dd></div>
                  <div>
                    <dt>{getReportedSubjectFieldLabel(detail?.reportType)}</dt>
                    <dd>{getReportedSubjectValue(detail)}</dd>
                  </div>
                  {shouldShowRelatedTargetField(detail?.reportType) ? (
                    <div>
                      <dt>Thuộc sản phẩm/gian hàng</dt>
                      <dd>{getRelatedTargetValue(detail)}</dd>
                    </div>
                  ) : null}
                  <div><dt>Người báo cáo</dt><dd>{detail?.reporter?.fullName || detail?.reporter?.userName || '—'}</dd></div>
                  <div><dt>Email người báo cáo</dt><dd>{detail?.reporter?.email || '—'}</dd></div>
                  {detail?.processedBy ? (
                    <div>
                      <dt>Người xử lý</dt>
                      <dd>{detail.processedBy.fullName || detail.processedBy.userName || '—'}</dd>
                    </div>
                  ) : null}
                  <div><dt>Thời gian gửi</dt><dd>{formatDate(detail?.createdAt)}</dd></div>
                  <div><dt>Thời gian xử lý</dt><dd>{formatDate(detail?.processedAt)}</dd></div>
                </dl>
              </section>

              <section className="modal-section modal-section-actions">
                <h4>Xử lý báo cáo</h4>
                {!isPending ? (
                  <div className="empty-card">Báo cáo này đã được xử lý trước đó.</div>
                ) : showApproveOptions ? (
                  <div className="action-option-group">
                    <p>{approvePrompt}</p>
                    {approveActionOptions.map((option) => (
                      <label key={option.value} className="action-option">
                        <input
                          type="radio"
                          name="reportAction"
                          value={option.value}
                          checked={selectedAction === option.value}
                          onChange={() => onSelectAction(option.value)}
                        />
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </label>
                    ))}
                    <div className="dialog-actions">
                      <button type="button" className="ghost-btn" disabled={actionLoading} onClick={onCancelApprove}>
                        Quay lại
                      </button>
                      <button type="button" className="approve-btn" disabled={actionLoading} onClick={onConfirmApprove}>
                        {actionLoading ? 'Đang xử lý...' : 'Xác nhận duyệt'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>
                      Xem xét nội dung vi phạm và chọn bác bỏ nếu báo cáo không hợp lệ, hoặc duyệt vi phạm để áp dụng
                      biện pháp xử lý.
                    </p>
                    <div className="dialog-actions modal-action-stack">
                      <button
                        type="button"
                        className="outline-btn-danger"
                        disabled={actionLoading}
                        onClick={onDismiss}
                      >
                        {actionLoading ? 'Đang xử lý...' : 'Bác bỏ'}
                      </button>
                      <button type="button" className="approve-btn" disabled={actionLoading} onClick={onApprove}>
                        Duyệt vi phạm
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>

            {shop && detail?.reportType === REPORT_TYPE.SHOP ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin bổ sung gian hàng</h4>
                <dl className="detail-list">
                  <div><dt>Địa chỉ</dt><dd>{shop.address || '—'}</dd></div>
                  <div><dt>Số điện thoại</dt><dd>{shop.phone || '—'}</dd></div>
                </dl>
              </section>
            ) : null}

            {shop && detail?.reportType !== REPORT_TYPE.SHOP ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin gian hàng liên quan</h4>
                <dl className="detail-list">
                  <div><dt>Tên gian hàng</dt><dd>{shop.name || '—'}</dd></div>
                  <div><dt>Địa chỉ</dt><dd>{shop.address || '—'}</dd></div>
                  <div><dt>Số điện thoại</dt><dd>{shop.phone || '—'}</dd></div>
                </dl>
              </section>
            ) : null}

            {product && detail?.reportType === REPORT_TYPE.PRODUCT ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin bổ sung sản phẩm</h4>
                <dl className="detail-list">
                  {product.shopName ? (
                    <div><dt>Gian hàng</dt><dd>{product.shopName}</dd></div>
                  ) : null}
                  {product.description ? (
                    <div><dt>Mô tả</dt><dd>{product.description}</dd></div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {product && detail?.reportType !== REPORT_TYPE.PRODUCT ? (
              <section className="modal-section modal-section-full">
                <h4>Thông tin sản phẩm liên quan</h4>
                <dl className="detail-list">
                  <div><dt>Tên sản phẩm</dt><dd>{product.name || '—'}</dd></div>
                  {product.shopName ? (
                    <div><dt>Gian hàng</dt><dd>{product.shopName}</dd></div>
                  ) : null}
                  {product.description ? (
                    <div><dt>Mô tả</dt><dd>{product.description}</dd></div>
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

            <section className="modal-section modal-section-full modal-section-evidence">
              <EvidenceImagesSection images={evidenceImages} onPreview={handlePreview} />
            </section>
          </div>
        )}
      </div>

      <ImagePreviewModal imageUrl={previewImage} onClose={closePreview} />
    </div>
  );
}

export default function ReportManagement() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [reportType, setReportType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [dataMeta, setDataMeta] = useState(null);

  const [selectedReportId, setSelectedReportId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveOptions, setShowApproveOptions] = useState(false);
  const [selectedAction, setSelectedAction] = useState('hide');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await listReports(token, {
        search,
        reportType,
        status,
        page,
        limit: 20,
      });

      setItems(payload.data?.items || []);
      setPagination(payload.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      setDataMeta(payload.data?.meta || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách báo cáo.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, page, reportType, search, status]);

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

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setSnackbar(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [snackbar]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleFilterChange(setter, value) {
    setter(value);
    setPage(1);
  }

  function openDetail(reportId) {
    setSelectedReportId(reportId);
    setShowApproveOptions(false);
    setSelectedAction('hide');
    loadDetail(reportId);
  }

  function closeDetail() {
    if (actionLoading) {
      return;
    }
    setSelectedReportId('');
    setDetail(null);
    setShowApproveOptions(false);
  }

  async function refreshAfterAction(message, updatedReport) {
    setSnackbar(message);
    setDetail(updatedReport);
    setShowApproveOptions(false);
    await loadItems();
  }

  async function handleDismiss() {
    if (!selectedReportId) {
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await dismissReport(token, selectedReportId);
      await refreshAfterAction(payload.message || 'Đã bác bỏ báo cáo vi phạm.', payload.data?.report);
    } catch (actionError) {
      setError(actionError.message || 'Không bác bỏ được báo cáo.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleApproveClick() {
    setSelectedAction(getDefaultApproveAction(detail?.reportType));
    setShowApproveOptions(true);
  }

  async function handleConfirmApprove(action = selectedAction) {
    if (!selectedReportId) {
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await approveReport(token, selectedReportId, action);
      await refreshAfterAction(payload.message || 'Đã duyệt vi phạm thành công.', payload.data?.report);
    } catch (actionError) {
      setError(actionError.message || 'Không duyệt được báo cáo.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Quản lý báo cáo vi phạm</h1>
          <p>
            Dữ liệu được tải trực tiếp từ MongoDB (collection <code>reports</code>). Theo dõi, xem chi
            tiết và xử lý các báo cáo vi phạm từ người dùng.
          </p>
        </div>
        <button type="button" onClick={loadItems} disabled={loading}>
          Làm mới
        </button>
      </header>

      <section className="filter-card">
        <form className="filter-form" onSubmit={handleSearchSubmit}>
          <label className="filter-search">
            Tìm kiếm
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nội dung, lý do, tên người báo cáo..."
            />
          </label>
          <button type="submit" className="primary-btn">
            Tìm
          </button>
        </form>

        <div className="filter-grid">
          <label>
            Loại vi phạm
            <select
              value={reportType}
              onChange={(event) => handleFilterChange(setReportType, event.target.value)}
            >
              {REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.value || 'all-type'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Trạng thái
            <select value={status} onChange={(event) => handleFilterChange(setStatus, event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all-status'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {snackbar ? <p className="snackbar">{snackbar}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <div className="account-table-wrap">
        <table className="account-table">
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
                <td colSpan={7}>
                  <div className="empty-card">Không tìm thấy báo cáo phù hợp.</div>
                </td>
              </tr>
            ) : null}
            {!loading
              ? items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="account-primary">{item.content || item.title || '—'}</div>
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
                      <div>{item.reporter?.fullName || item.reporter?.userName || '—'}</div>
                      <div className="account-secondary">{item.reporter?.email || '—'}</div>
                    </td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>{item.statusLabel}</span>
                    </td>
                    <td>
                      <div className="account-secondary">Gửi: {formatDate(item.createdAt)}</div>
                      <div className="account-secondary">Xử lý: {formatDate(item.processedAt)}</div>
                    </td>
                    <td>
                      <button type="button" className="table-link" onClick={() => openDetail(item.id)}>
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <span>
          Trang {pagination.page}/{pagination.totalPages} • {pagination.total} báo cáo
          {dataMeta?.dataSource ? ` • Nguồn: ${dataMeta.dataSource}` : ''}
        </span>
        <div className="pagination-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Trước
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Sau
          </button>
        </div>
      </div>

      {selectedReportId ? (
        <ReportDetailModal
          detail={detail}
          loading={detailLoading}
          actionLoading={actionLoading}
          onClose={closeDetail}
          onDismiss={handleDismiss}
          onApprove={handleApproveClick}
          showApproveOptions={showApproveOptions}
          selectedAction={selectedAction}
          onSelectAction={setSelectedAction}
          onConfirmApprove={() => handleConfirmApprove(selectedAction)}
          onCancelApprove={() => setShowApproveOptions(false)}
        />
      ) : null}
    </div>
  );
}

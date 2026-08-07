import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Eye,
  Mail,
  Phone,
  Scale,
  ShoppingBag,
  Star,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';

import {
  blockAccount,
  getAccountDetail,
  getAccountFinance,
  getAccountFollowers,
  getAccountFollowing,
  getAccountHistory,
  unblockAccount,
} from '../api/accountApi';
import { deleteProduct, blockShop, unblockShop } from '../api/catalogApi';
import { getReportDetail } from '../api/reportApi';
import { getReservationDetail } from '../api/reservationAdminApi';
import AdminDetailTabs from '../components/admin/AdminDetailTabs';
import HistoryStatusFilter from '../components/admin/HistoryStatusFilter';
import AdminPagination from '../components/admin/AdminPagination';
import { TableSttCell, TableSttHeader } from '../components/admin/TableStt';
import ProductRemoveDialog from '../components/admin/ProductRemoveDialog';
import {
  ProductDiscountCell,
  ProductOriginalPriceCell,
  ProductPriceStack,
} from '../components/admin/ProductAdminPriceCells';
import FollowListDialog, { FollowStatButton } from '../components/admin/FollowListDialog';
import TableIconActions from '../components/ui/TableIconActions';
import { EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import {
  getHistoryStatusFilters,
  HISTORY_STATUS_FILTER_ALL,
} from '../config/historyStatusFilters';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { formatDate, formatMoney, formatPrice } from '../utils/format';
import { goBackOr } from '../utils/navigation';
import { keepIfSame, mergeListById } from '../utils/realtimeList';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
}

function formatJoinDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('vi-VN');
}

function DetailSkeleton() {
  return (
    <div className="shop-detail-v2-skeleton">
      <div className="skeleton skeleton-card shop-detail-hero-skeleton" />
      <div className="shop-detail-stat-skeleton">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton skeleton-card" />
        ))}
      </div>
    </div>
  );
}

export const ACCOUNT_DETAIL_HISTORY_TABS = [
  { id: 'reservations', label: 'Quản lý đơn hàng' },
  { id: 'reports-filed', label: 'Báo cáo đã gửi' },
  { id: 'reports-received', label: 'Báo cáo nhận được' },
  { id: 'reviews', label: 'Đã đánh giá' },
  { id: 'wallet', label: 'Ví tiền' },
];

export const ACCOUNT_MAIN_TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'history', label: 'Lịch sử hoạt động' },
];

export const BUYER_HISTORY_TABS = ACCOUNT_DETAIL_HISTORY_TABS;

export const ACCOUNT_SHOP_HISTORY_TABS = [
  { id: 'products', label: 'Sản phẩm' },
  { id: 'shop-reservations', label: 'Đơn của shop' },
  { id: 'reports-filed', label: 'Báo cáo đã gửi' },
  { id: 'reports-received', label: 'Báo cáo bị nhận' },
  { id: 'shop-reviews', label: 'Đánh giá nhận được' },
];

export const SHOP_DETAIL_HISTORY_TABS = [
  ...ACCOUNT_SHOP_HISTORY_TABS,
  { id: 'wallet', label: 'Ví tiền' },
  { id: 'seller-subscriptions', label: 'Gói seller' },
  { id: 'seller-banners', label: 'Gói banner' },
];

/** @deprecated Dùng ACCOUNT_SHOP_HISTORY_TABS hoặc SHOP_DETAIL_HISTORY_TABS */
export const SHOP_HISTORY_TABS = SHOP_DETAIL_HISTORY_TABS;

export function buildAccountDetailTabs() {
  return ACCOUNT_DETAIL_HISTORY_TABS;
}

function txAmountClass(type) {
  // Nạp/hoàn/nhận cọc là tiền vào, còn lại là tiền ra.
  return [1, 3, 6, 7].includes(type) ? 'badge badge-success' : 'badge badge-warning';
}

function resolveMediaUrls(sources = [], fallback = '') {
  const fromList = sources
    .map((item) => (typeof item === 'string' ? item : item?.imageUrl || item?.url || ''))
    .filter(Boolean);
  if (fromList.length) return fromList;
  return fallback ? [fallback] : [];
}

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function HistoryDetailDialog({ tab, item, detail, loading, error, onClose }) {
  if (!item) return null;

  const titleMap = {
    wallet: 'Chi tiết giao dịch ví',
    withdrawals: 'Chi tiết rút tiền',
    products: 'Chi tiết sản phẩm',
    reservations: 'Chi tiết đơn hàng',
    'shop-reservations': 'Chi tiết đơn của shop',
    'reports-filed': 'Chi tiết báo cáo đã gửi',
    'reports-received': 'Chi tiết báo cáo bị nhận',
    reports: 'Chi tiết báo cáo',
    reviews: 'Chi tiết đánh giá',
    'shop-reviews': 'Chi tiết đánh giá',
    'seller-subscriptions': 'Chi tiết gói seller',
    'seller-banners': 'Chi tiết gói banner',
  };

  const product = detail || item;
  const reservation = detail?.reservation || detail || item;
  const report = detail || item;

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide history-detail-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3>{titleMap[tab] || 'Chi tiết'}</h3>
            <p className="muted">ID: {item.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}
        {loading ? (
          <div className="modal-loading">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : null}

        {!loading && tab === 'wallet' ? (
          <dl className="detail-list detail-list-grid">
            <DetailField label="Loại">
              <span className={txAmountClass(item.type)}>{item.typeLabel}</span>
            </DetailField>
            <DetailField label="Số tiền">{formatMoney(item.amount)}</DetailField>
            <DetailField label="Trạng thái">{item.statusLabel}</DetailField>
            <DetailField label="Số dư trước">
              {item.balanceBefore == null ? '' : formatMoney(item.balanceBefore)}
            </DetailField>
            <DetailField label="Số dư sau">
              {item.balanceAfter == null ? '' : formatMoney(item.balanceAfter)}
            </DetailField>
            <DetailField label="Mã đơn">{item.orderCode || ''}</DetailField>
            <DetailField label="Tham chiếu">
              {[item.referenceType, item.referenceId].filter(Boolean).join(' · ') || ''}
            </DetailField>
            <DetailField label="Reservation">{item.reservationId || ''}</DetailField>
            <DetailField label="Mô tả">{item.description || ''}</DetailField>
            <DetailField label="Thời gian">{formatDate(item.createdAt)}</DetailField>
          </dl>
        ) : null}

        {!loading && tab === 'withdrawals' ? (
          <dl className="detail-list detail-list-grid">
            <DetailField label="Số tiền">{formatMoney(item.amount)}</DetailField>
            <DetailField label="Trạng thái">{item.statusLabel}</DetailField>
            <DetailField label="Ngân hàng">
              {item.bankName}
              {item.bankCode ? ` (${item.bankCode})` : ''}
            </DetailField>
            <DetailField label="Số tài khoản">{item.accountNumber || ''}</DetailField>
            <DetailField label="Chủ tài khoản">{item.accountName || ''}</DetailField>
            <DetailField label="Ghi chú admin">{item.adminNote || ''}</DetailField>
            <DetailField label="Xử lý lúc">{formatDate(item.processedAt)}</DetailField>
            <DetailField label="Tạo lúc">{formatDate(item.createdAt)}</DetailField>
          </dl>
        ) : null}

        {!loading && tab === 'products' ? (
          <>
            <dl className="detail-list detail-list-grid">
              <DetailField label="Tên">{product.productName || item.productName || ''}</DetailField>
              <DetailField label="Danh mục">{product.categoryName || item.categoryName || ''}</DetailField>
              <DetailField label="Giá">
                <ProductPriceStack item={product} />
              </DetailField>
              {product.isPromotion && Number(product.discountPercent) > 0 ? (
                <DetailField label="Giảm giá">
                  <span className="badge badge-warning history-product-discount">
                    {product.discountLabel || `−${product.discountPercent}%`}
                  </span>
                </DetailField>
              ) : null}
              <DetailField label="Đơn vị">{product.donVi || item.donVi || ''}</DetailField>
              <DetailField label="Trạng thái">
                {product.statusLabel ||
                  item.statusLabel ||
                  ((product.isDeleted ?? item.isDeleted)
                    ? 'Đã xóa'
                    : (product.status ?? item.status) === 1
                      ? 'Đang hiện'
                      : 'Đã ẩn')}
              </DetailField>
              {(product.isAdminRemoved ?? item.isAdminRemoved) ? (
                <DetailField label="Lý do gỡ">
                  {product.adminRemovalReason || item.adminRemovalReason || '—'}
                </DetailField>
              ) : null}
              <DetailField label="Đã bán">{product.soldCount ?? item.soldCount ?? 0}</DetailField>
              <DetailField label="Lượt xem">{product.viewCount ?? item.viewCount ?? 0}</DetailField>
              <DetailField label="Lượt thích">{product.likeCount ?? item.likeCount ?? 0}</DetailField>
              <DetailField label="Yêu thích">{product.favoriteCount ?? ''}</DetailField>
              <DetailField label="Đơn hàng">
                {product.reservationCount ?? 0} (hoàn thành {product.completedReservations ?? 0})
              </DetailField>
              <DetailField label="Gian hàng">
                {product.shopName || item.shopName || ''}
                {product.shopUsername || item.shopUsername
                  ? ` (@${product.shopUsername || item.shopUsername})`
                  : ''}
              </DetailField>
              <DetailField label="Tạo lúc">
                {formatDate(product.createdAt || item.createdAt)}
              </DetailField>
            </dl>
            {product.description || item.description ? (
              <p className="history-detail-desc">{product.description || item.description}</p>
            ) : null}
            <div className="history-variant-block">
              <h4>Phân loại / biến thể ({(product.variants || []).length})</h4>
              {(product.variants || []).length === 0 ? (
                <p className="muted">Chưa có biến thể.</p>
              ) : (
                <ul className="variant-list">
                  {(product.variants || []).map((variant) => (
                    <li key={variant.id}>
                      <strong>{variant.variantName || ''}</strong>
                      <span>
                        {formatMoney(variant.price)} · Tồn {variant.quantity ?? 0} · Đã bán{' '}
                        {variant.soldCount ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {resolveMediaUrls(
              product.images || product.thumbnails || [],
              product.thumbnail || item.thumbnail
            ).length ? (
              <div className="image-grid account-verify-images">
                {resolveMediaUrls(
                  product.images || product.thumbnails || [],
                  product.thumbnail || item.thumbnail
                ).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Ảnh sản phẩm" />
                  </a>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && (tab === 'reservations' || tab === 'shop-reservations') ? (
          <>
            <dl className="detail-list detail-list-grid">
              <DetailField label="Trạng thái">
                {reservation.statusLabel || item.statusLabel}
              </DetailField>
              <DetailField label="Mã đơn">
                {reservation.code ||
                  reservation.orderCode ||
                  (item.id ? String(item.id).slice(-8).toUpperCase() : '')}
              </DetailField>
              <DetailField label="Sản phẩm">
                {reservation.product?.productName ||
                  reservation.product?.name ||
                  item.product?.name ||
                  ''}
              </DetailField>
              <DetailField label="Shop">
                {reservation.shopInfo?.shopName ||
                  reservation.shop?.shopName ||
                  reservation.shopName ||
                  item.shop?.shopName ||
                  ''}
              </DetailField>
              <DetailField label="Người bán">
                {reservation.seller?.fullName ||
                  reservation.seller?.userName ||
                  reservation.shopInfo?.fullName ||
                  ''}
              </DetailField>
              <DetailField label="Người mua">
                {reservation.buyer?.fullName ||
                  reservation.buyer?.userName ||
                  item.buyer?.fullName ||
                  item.buyer?.userName ||
                  ''}
              </DetailField>
              <DetailField label="Email buyer">
                {reservation.buyer?.email || item.buyer?.email || ''}
              </DetailField>
              <DetailField label="SĐT buyer">
                {reservation.buyer?.phone || ''}
              </DetailField>
              <DetailField label="Số lượng">{reservation.quantity ?? item.quantity}</DetailField>
              <DetailField label="Đơn giá">
                {formatMoney(reservation.reservedPrice ?? item.reservedPrice)}
              </DetailField>
              <DetailField label="Tổng tiền">
                {formatMoney(
                  reservation.totalPrice ??
                    item.totalPrice ??
                    (Number(reservation.reservedPrice || 0) *
                      Number(reservation.quantity || 0))
                )}
              </DetailField>
              <DetailField label="Cọc">
                {formatMoney(reservation.depositAmount ?? item.depositAmount)}
              </DetailField>
              <DetailField label="Ghi chú">{reservation.note || ''}</DetailField>
              <DetailField label="Lý do hủy">{reservation.cancelReason || ''}</DetailField>
              <DetailField label="Lý do tranh chấp">
                {reservation.disputeReasonLabel || reservation.disputeReason || ''}
              </DetailField>
              <DetailField label="Mô tả tranh chấp">
                {reservation.disputeDescription || ''}
              </DetailField>
              <DetailField label="Nhận hàng">
                {formatDate(reservation.pickupTime || item.pickupTime)}
              </DetailField>
              <DetailField label="Tranh chấp buyer">
                {reservation.disputeByBuyer || item.disputeByBuyer ? 'Có' : 'Không'}
              </DetailField>
              <DetailField label="Tranh chấp seller">
                {reservation.disputeBySeller || item.disputeBySeller ? 'Có' : 'Không'}
              </DetailField>
              <DetailField label="Tạo lúc">
                {formatDate(reservation.createdAt || item.createdAt)}
              </DetailField>
              <DetailField label="Hoàn thành">
                {formatDate(reservation.completedAt || item.completedAt)}
              </DetailField>
            </dl>
            {item.id ? (
              <div className="dialog-actions">
                <Link className="primary-btn" to={`/reservations/${item.id}`} onClick={onClose}>
                  Mở trang đơn đầy đủ
                </Link>
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && (tab === 'reports-filed' || tab === 'reports-received' || tab === 'reports') ? (
          <>
            <dl className="detail-list detail-list-grid">
              <DetailField label="Loại">{report.reportTypeLabel || item.reportTypeLabel}</DetailField>
              <DetailField label="Trạng thái">{report.statusLabel || item.statusLabel}</DetailField>
              <DetailField label="Vai trò người gửi">
                {report.reporterRoleLabel || item.reporterRoleLabel || ''}
              </DetailField>
              <DetailField label="Tiêu đề">{report.title || item.title || ''}</DetailField>
              <DetailField label="Lý do">{report.reasonLabel || ''}</DetailField>
              <DetailField label="Đơn liên quan">
                {report.reservationId || item.reservationId || ''}
              </DetailField>
              <DetailField label="Tạo lúc">
                {formatDate(report.createdAt || item.createdAt)}
              </DetailField>
              <DetailField label="Xử lý lúc">
                {formatDate(report.processedAt || item.processedAt)}
              </DetailField>
            </dl>
            <p className="history-detail-desc">{report.content || item.content || ''}</p>
            {resolveMediaUrls(report.evidenceImages || []).length ? (
              <div className="image-grid account-verify-images">
                {resolveMediaUrls(report.evidenceImages || []).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Bằng chứng" />
                  </a>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {!loading && (tab === 'reviews' || tab === 'shop-reviews') ? (
          <dl className="detail-list detail-list-grid">
            {tab === 'shop-reviews' ? (
              <>
                <DetailField label="Người mua">
                  {item.reviewer?.fullName || item.reviewer?.userName || ''}
                </DetailField>
                <DetailField label="Sản phẩm">{item.product?.name || ''}</DetailField>
              </>
            ) : (
              <>
                <DetailField label="Sản phẩm">{item.product?.name || ''}</DetailField>
                <DetailField label="Shop">{item.shop?.shopName || ''}</DetailField>
              </>
            )}
            <DetailField label="Số sao">{'★'.repeat(item.rating || 0) || ''}</DetailField>
            <DetailField label="Nội dung">{item.comment || ''}</DetailField>
            <DetailField label="Hiển thị">
              {item.isDeleted ? 'Đã xóa' : item.isHidden ? 'Đang ẩn' : 'Hiển thị'}
            </DetailField>
            <DetailField label="Thời gian">{formatDate(item.createdAt)}</DetailField>
          </dl>
        ) : null}

        {!loading && tab === 'seller-subscriptions' ? (
          <dl className="detail-list detail-list-grid">
            <DetailField label="Gói">{item.planName || ''}</DetailField>
            <DetailField label="Giá">{item.amountLabel || formatMoney(item.amount)}</DetailField>
            <DetailField label="Trạng thái">{item.statusLabel || ''}</DetailField>
            <DetailField label="Ngày mua">{formatDate(item.ngayMua || item.createdAt)}</DetailField>
            <DetailField label="Bắt đầu">{formatDate(item.startDate)}</DetailField>
            <DetailField label="Kết thúc">{formatDate(item.endDate)}</DetailField>
            <DetailField label="Mã GD">{item.orderCode || ''}</DetailField>
          </dl>
        ) : null}

        {!loading && tab === 'seller-banners' ? (
          <>
            <dl className="detail-list detail-list-grid">
              <DetailField label="Gói banner">{item.planName || ''}</DetailField>
              <DetailField label="Giá">{item.amountLabel || formatMoney(item.amount)}</DetailField>
              <DetailField label="Trạng thái">{item.statusLabel || ''}</DetailField>
              <DetailField label="Đích đến">
                {item.targetTypeLabel || ''}
                {item.targetId ? ` (${item.targetId})` : ''}
              </DetailField>
              <DetailField label="Ngày mua">{formatDate(item.ngayMua || item.createdAt)}</DetailField>
              <DetailField label="Bắt đầu">{formatDate(item.startDate) || '—'}</DetailField>
              <DetailField label="Kết thúc">{formatDate(item.endDate) || '—'}</DetailField>
              <DetailField label="Số click">{item.clickCount ?? 0}</DetailField>
              <DetailField label="Lý do">{item.violationReason || '—'}</DetailField>
            </dl>
            {item.image ? (
              <div className="image-grid account-verify-images">
                <a href={item.image} target="_blank" rel="noreferrer">
                  <img src={item.image} alt="Banner" />
                </a>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function HistoryTable({
  tab,
  items,
  onViewDetail,
  page = 1,
  limit = 10,
  onRemoveProduct,
  busyProductId = '',
  removeLoading = false,
}) {
  if (!items.length) {
    return <EmptyState title="Chưa có dữ liệu" description="Không có bản ghi nào trong mục này." />;
  }

  if (tab === 'wallet') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <TableSttHeader />
            <th>Loại</th>
            <th>Số tiền</th>
            <th>Trạng thái</th>
            <th>Mô tả</th>
            <th>Số dư sau</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((tx, index) => (
            <tr key={tx.id}>
              <TableSttCell page={page} limit={limit} index={index} />
              <td><span className={txAmountClass(tx.type)}>{tx.typeLabel}</span></td>
              <td><strong>{formatMoney(tx.amount)}</strong></td>
              <td>{tx.statusLabel}</td>
              <td className="category-desc-cell">{tx.description || ''}</td>
              <td>{tx.balanceAfter === null ? '' : formatMoney(tx.balanceAfter)}</td>
              <td>{formatDate(tx.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(tx)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'withdrawals') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <TableSttHeader />
            <th>Số tiền</th>
            <th>Ngân hàng</th>
            <th>Tài khoản</th>
            <th>Trạng thái</th>
            <th>Ghi chú admin</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={row.id}>
              <TableSttCell page={page} limit={limit} index={index} />
              <td><strong>{formatMoney(row.amount)}</strong></td>
              <td>{row.bankName}{row.bankCode ? ` (${row.bankCode})` : ''}</td>
              <td>{row.accountNumber} — {row.accountName}</td>
              <td>{row.statusLabel}</td>
              <td className="category-desc-cell">{row.adminNote || ''}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'products') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <TableSttHeader />
            <th />
            <th>Sản phẩm</th>
            <th className="col-price">Giá gốc</th>
            <th className="col-discount">Giảm giá</th>
            <th>Trạng thái</th>
            <th>View</th>
            <th>Tym</th>
            <th>Đã bán</th>
            <th>Thời gian</th>
            <th className="col-actions">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={row.id}>
              <TableSttCell page={page} limit={limit} index={index} />
              <td className="col-thumb">
                {row.thumbnail ? (
                  <img src={row.thumbnail} alt="" className="thumb-sm" />
                ) : (
                  <div className="thumb-sm thumb-fallback">SP</div>
                )}
              </td>
              <td>
                <div className="cell-title">{row.productName || ''}</div>
                <div className="cell-sub">{row.categoryName || 'Chưa có danh mục'}</div>
              </td>
              <td className="col-price">
                <ProductOriginalPriceCell item={row} />
              </td>
              <td className="col-discount">
                <ProductDiscountCell item={row} />
              </td>
              <td>
                <span
                  className={
                    row.isDeleted
                      ? 'badge badge-danger'
                      : row.status === 1
                        ? 'badge badge-success'
                        : 'badge badge-neutral'
                  }
                >
                  {row.statusLabel || (row.status === 1 ? 'Đang hiện' : 'Đã ẩn')}
                </span>
              </td>
              <td>{row.viewCount ?? 0}</td>
              <td>{row.likeCount ?? 0}</td>
              <td>{row.soldCount || 0}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td className="col-actions">
                <TableIconActions
                  actions={[
                    {
                      icon: Eye,
                      label: 'Xem chi tiết',
                      onClick: () => onViewDetail(row),
                    },
                    row.isDeleted
                      ? null
                      : {
                          icon: Trash2,
                          label: 'Gỡ sản phẩm vi phạm',
                          variant: 'danger',
                          disabled: busyProductId === row.id || removeLoading,
                          onClick: () => onRemoveProduct?.(row),
                        },
                  ].filter(Boolean)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'reservations' || tab === 'shop-reservations') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <TableSttHeader />
            <th>Sản phẩm</th>
            <th>{tab === 'reservations' ? 'Shop' : 'Người mua'}</th>
            <th>SL</th>
            <th>Tổng tiền</th>
            <th>Cọc</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={row.id}>
              <TableSttCell page={page} limit={limit} index={index} />
              <td>{row.product?.name || ''}</td>
              <td>
                {tab === 'reservations'
                  ? row.shop?.shopName || ''
                  : row.buyer?.fullName || row.buyer?.userName || ''}
              </td>
              <td>{row.quantity}</td>
              <td>{formatMoney(row.totalPrice)}</td>
              <td>{formatMoney(row.depositAmount)}</td>
              <td>{row.statusLabel}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'reports-filed' || tab === 'reports-received' || tab === 'reports') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <TableSttHeader />
            <th>Loại</th>
            <th>Tiêu đề</th>
            <th>Nội dung</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={row.id}>
              <TableSttCell page={page} limit={limit} index={index} />
              <td>{row.reportTypeLabel}</td>
              <td>{row.title || ''}</td>
              <td className="category-desc-cell">{row.content || ''}</td>
              <td>{row.statusLabel}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'seller-subscriptions') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <TableSttHeader />
            <th>Gói seller</th>
            <th>Giá</th>
            <th>Trạng thái</th>
            <th>Ngày mua</th>
            <th>Hiệu lực</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={row.id}>
              <TableSttCell page={page} limit={limit} index={index} />
              <td><strong>{row.planName || '—'}</strong></td>
              <td className="cell-price">{row.amountLabel || formatMoney(row.amount)}</td>
              <td>{row.statusLabel || ''}</td>
              <td>{formatDate(row.ngayMua || row.createdAt)}</td>
              <td>
                {formatDate(row.startDate) || '—'} – {formatDate(row.endDate) || '—'}
              </td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'seller-banners') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <TableSttHeader />
            <th />
            <th>Gói banner</th>
            <th>Giá</th>
            <th>Đích đến</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={row.id}>
              <TableSttCell page={page} limit={limit} index={index} />
              <td className="col-thumb">
                {row.image ? (
                  <img src={row.image} alt="" className="thumb-sm" />
                ) : (
                  <div className="thumb-sm thumb-fallback">BN</div>
                )}
              </td>
              <td><strong>{row.planName || '—'}</strong></td>
              <td className="cell-price">{row.amountLabel || formatMoney(row.amount)}</td>
              <td>
                {row.targetTypeLabel || '—'}
                {row.targetId ? ` · ${row.targetId}` : ''}
              </td>
              <td>{row.statusLabel || ''}</td>
              <td>{formatDate(row.ngayMua || row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'shop-reviews') {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <TableSttHeader />
            <th>Người mua</th>
            <th>Sản phẩm</th>
            <th>Số sao</th>
            <th>Nội dung</th>
            <th>Hiển thị</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={row.id}>
              <TableSttCell page={page} limit={limit} index={index} />
              <td>{row.reviewer?.fullName || row.reviewer?.userName || ''}</td>
              <td>{row.product?.name || ''}</td>
              <td>{'★'.repeat(Number(row.rating) || 0)}</td>
              <td className="category-desc-cell">{row.comment || ''}</td>
              <td>{row.isDeleted ? 'Đã xóa' : row.isHidden ? 'Đang ẩn' : 'Hiển thị'}</td>
              <td>{formatDate(row.createdAt)}</td>
              <td>
                <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <TableSttHeader />
          <th>Sản phẩm</th>
          <th>Shop</th>
          <th>Số sao</th>
          <th>Nội dung</th>
          <th>Hiển thị</th>
          <th>Thời gian</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((row, index) => (
          <tr key={row.id}>
            <TableSttCell page={page} limit={limit} index={index} />
            <td>{row.product?.name || ''}</td>
            <td>{row.shop?.shopName || ''}</td>
            <td>{'★'.repeat(Number(row.rating) || 0)}</td>
            <td className="category-desc-cell">{row.comment || ''}</td>
            <td>{row.isDeleted ? 'Đã xóa' : row.isHidden ? 'Đang ẩn' : 'Hiển thị'}</td>
            <td>{formatDate(row.createdAt)}</td>
            <td>
              <button type="button" className="detail-btn" onClick={() => onViewDetail(row)}>
                Chi tiết
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const HISTORY_TAB_REALTIME_RESOURCES = {
  products: 'product',
  wallet: 'wallet',
  withdrawals: 'withdraw',
  // Backend phát event đơn hàng với type "order".
  reservations: 'order',
  'shop-reservations': 'order',
  'reports-filed': 'report',
  'reports-received': 'report',
  reviews: 'review',
  'shop-reviews': 'review',
  'seller-subscriptions': 'subscription',
  'seller-banners': 'banner',
};

export function ActivityHistorySection({
  entityId,
  getIdToken,
  tabs = BUYER_HISTORY_TABS,
  loadHistory = getAccountHistory,
  tabVariant = 'pill',
  panelClassName = '',
  hideTitle = false,
  activeTab: controlledTab,
  onTabChange,
  sectionRef,
}) {
  const navigate = useNavigate();
  const defaultTab = tabs[0]?.id || 'wallet';
  const [internalTab, setInternalTab] = useState(defaultTab);
  const tab = controlledTab ?? internalTab;

  function setTab(nextTab) {
    if (onTabChange) {
      onTabChange(nextTab);
    }
    if (controlledTab === undefined) {
      setInternalTab(nextTab);
    }
  }
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState(HISTORY_STATUS_FILTER_ALL);
  const [data, setData] = useState({ items: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeError, setRemoveError] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);
  const [busyProductId, setBusyProductId] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  // Lần tải kế tiếp đến từ realtime → không bật loading, không nháy bảng.
  const silentReloadRef = useRef(false);

  useEffect(() => {
    if (!tabs.some((item) => item.id === tab)) {
      setTab(tabs[0]?.id || 'wallet');
      setPage(1);
    }
  }, [tab, tabs]);

  const statusFilterOptions = useMemo(() => getHistoryStatusFilters(tab) || [], [tab]);

  useEffect(() => {
    setStatusFilter(HISTORY_STATUS_FILTER_ALL);
  }, [tab]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const silent = silentReloadRef.current;
      silentReloadRef.current = false;
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const token = await getIdToken();
        const params = { tab, page, limit };
        if (statusFilter && statusFilter !== HISTORY_STATUS_FILTER_ALL) {
          params.status = statusFilter;
        }
        const payload = await loadHistory(token, entityId, params);
        if (!cancelled) {
          setData((current) => {
            const nextItems = mergeListById(current.items, payload.data?.items || []);
            const nextPagination = keepIfSame(
              current.pagination,
              payload.data?.pagination || null
            );
            if (nextItems === current.items && nextPagination === current.pagination) {
              return current;
            }
            return { items: nextItems, pagination: nextPagination };
          });
        }
      } catch (loadError) {
        if (!cancelled && !silent) {
          setError(loadError.message || 'Không tải được lịch sử.');
          setData({ items: [], pagination: null });
        }
      } finally {
        if (!cancelled && !silent) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [entityId, tab, page, limit, statusFilter, getIdToken, loadHistory, reloadTick]);

  const realtimeResource = HISTORY_TAB_REALTIME_RESOURCES[tab] || '';
  const refreshFromRealtime = useCallback(() => {
    silentReloadRef.current = true;
    setReloadTick((value) => value + 1);
  }, []);

  useAdminRealtimeRefresh(realtimeResource, refreshFromRealtime, {
    enabled: Boolean(realtimeResource),
    coalesceMs: REALTIME_COALESCE_MS,
  });

  async function openDetail(item) {
    if (tab === 'products' && item?.id) {
      navigate(`/products/${item.id}`);
      return;
    }

    setSelected(item);
    setDetail(null);
    setDetailError('');

    const needsFetch =
      tab === 'reservations' ||
      tab === 'shop-reservations' ||
      tab === 'reports-filed' ||
      tab === 'reports-received' ||
      tab === 'reports';

    if (!needsFetch || !item?.id) {
      return;
    }

    setDetailLoading(true);
    try {
      const token = await getIdToken();
      if (tab === 'reservations' || tab === 'shop-reservations') {
        const payload = await getReservationDetail(token, item.id);
        setDetail(payload.data?.reservation || null);
      } else if (tab === 'reports-filed' || tab === 'reports-received' || tab === 'reports') {
        const payload = await getReportDetail(token, item.id);
        setDetail(payload.data?.report || payload.data || null);
      }
    } catch (fetchError) {
      setDetailError(fetchError.message || 'Không tải được chi tiết.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelected(null);
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
  }

  function openRemoveProduct(product) {
    setRemoveError('');
    setRemoveTarget(product);
  }

  function closeRemoveProduct() {
    if (removeLoading) return;
    setRemoveTarget(null);
    setRemoveError('');
  }

  async function confirmRemoveProduct(reason) {
    if (!removeTarget?.id) return;
    setRemoveLoading(true);
    setBusyProductId(removeTarget.id);
    setRemoveError('');
    try {
      const token = await getIdToken();
      await deleteProduct(token, removeTarget.id, { reason });
      if (selected?.id === removeTarget.id) {
        closeDetail();
      }
      closeRemoveProduct();
      setReloadTick((tick) => tick + 1);
    } catch (removeErr) {
      setRemoveError(removeErr.message || 'Không gỡ được sản phẩm.');
    } finally {
      setRemoveLoading(false);
      setBusyProductId('');
    }
  }

  const pagination = data.pagination || {
    page,
    limit,
    total: data.items.length,
    totalPages: 1,
  };

  const isClassic = tabVariant === 'pill' && !panelClassName;

  function handleTabChange(nextTab) {
    setTab(nextTab);
    setPage(1);
    setStatusFilter(HISTORY_STATUS_FILTER_ALL);
    closeDetail();
  }

  return (
    <section
      ref={sectionRef}
      className={
        isClassic
          ? 'detail-card account-history-card'
          : `account-history-panel ${panelClassName}`.trim()
      }
    >
      {!hideTitle ? <h3>Lịch sử hoạt động</h3> : null}

      <div className="account-history-tabs-toolbar">
        {isClassic ? (
          <div className="detail-tabs">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'active' : undefined}
                onClick={() => handleTabChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <AdminDetailTabs
            tabs={tabs}
            activeTab={tab}
            onChange={handleTabChange}
            variant={tabVariant}
          />
        )}

        {statusFilterOptions.length ? (
          <HistoryStatusFilter
            options={statusFilterOptions}
            value={statusFilter}
            onChange={(nextStatus) => {
              setStatusFilter(nextStatus);
              setPage(1);
              closeDetail();
            }}
          />
        ) : null}
      </div>

      <div className={isClassic ? undefined : 'account-history-panel-body'}>
        {error ? <p className="error-banner">{error}</p> : null}
        {loading ? (
          <div className="skeleton skeleton-line" style={{ height: 120 }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <HistoryTable
              tab={tab}
              items={data.items}
              onViewDetail={openDetail}
              page={pagination.page}
              limit={limit}
              onRemoveProduct={tab === 'products' ? openRemoveProduct : undefined}
              busyProductId={busyProductId}
              removeLoading={removeLoading}
            />
          </div>
        )}

        <div className="admin-pagination">
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages || 1}
            total={pagination.total || 0}
            label="bản ghi"
            limit={limit}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      </div>

      {selected ? (
        <HistoryDetailDialog
          tab={tab}
          item={selected}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      ) : null}

      <ProductRemoveDialog
        product={removeTarget}
        open={Boolean(removeTarget)}
        loading={removeLoading}
        error={removeError}
        onClose={closeRemoveProduct}
        onConfirm={confirmRemoveProduct}
      />
    </section>
  );
}

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [account, setAccount] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [confirmAction, setConfirmAction] = useState('');
  const [followDialog, setFollowDialog] = useState('');
  const [mainTab, setMainTab] = useState('overview');
  const [historyTab, setHistoryTab] = useState('reservations');

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const [payload, financePayload] = await Promise.all([
        getAccountDetail(token, accountId),
        getAccountFinance(token, accountId).catch(() => null),
      ]);
      setAccount(payload.data?.account || null);
      setFinance(financePayload?.data?.finance || null);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết người dùng.');
      setAccount(null);
      setFinance(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, getIdToken]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (!snackbar) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setSnackbar(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [snackbar]);

  async function handleStatusChange(action) {
    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload =
        action === 'block-account'
          ? await blockAccount(token, accountId)
          : await unblockAccount(token, accountId);

      setAccount(payload.data?.account || null);
      setConfirmAction('');
    } catch (actionError) {
      setError(actionError.message || 'Không cập nhật được trạng thái tài khoản.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleShopStatusChange(action) {
    const shopId = account?.shop?.id;
    if (!shopId) {
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload =
        action === 'block-shop'
          ? await blockShop(token, shopId)
          : await unblockShop(token, shopId);
      const updatedShop = payload.data?.shop;
      if (updatedShop) {
        setAccount((current) =>
          current
            ? {
                ...current,
                shop: {
                  ...current.shop,
                  status: updatedShop.status,
                  statusLabel: updatedShop.statusLabel,
                },
              }
            : current
        );
      } else {
        await loadAccount();
      }
      setConfirmAction('');
    } catch (actionError) {
      setError(actionError.message || 'Thao tác gian hàng thất bại.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleConfirmAction() {
    if (confirmAction === 'block-account' || confirmAction === 'unblock-account') {
      return handleStatusChange(confirmAction);
    }
    if (confirmAction === 'block-shop' || confirmAction === 'unblock-shop') {
      return handleShopStatusChange(confirmAction);
    }
    return undefined;
  }

  const user = account?.user;
  const shop = account?.shop;
  const stats = account?.stats;
  const isAccountActive = user?.status === 1;
  const isShopActive = shop?.status === 1;

  const detailTabs = useMemo(() => buildAccountDetailTabs(), []);

  const loadFollowPage = useCallback(
    async (params) => {
      const token = await getIdToken();
      if (followDialog === 'following') {
        return getAccountFollowing(token, accountId, params);
      }
      if (followDialog === 'followers') {
        return getAccountFollowers(token, accountId, params);
      }
      return { data: { items: [], pagination: null } };
    },
    [accountId, followDialog, getIdToken]
  );

  const statCards = useMemo(
    () => [
      {
        label: 'Tổng đơn hàng',
        value: stats?.totalOrders || 0,
        icon: ShoppingBag,
        tone: 'blue',
      },
      {
        label: 'Đơn đã nhận',
        value: stats?.totalCompletedOrders || 0,
        icon: CheckCircle2,
        tone: 'green',
      },
      {
        label: 'Đã hủy',
        value: stats?.totalCancelledOrders || 0,
        icon: XCircle,
        tone: 'amber',
      },
      {
        label: 'Đơn tranh chấp',
        value: stats?.totalDisputes || 0,
        icon: Scale,
        tone: 'red',
      },
      {
        label: 'Đánh giá shop',
        value: stats?.totalReviewsWritten || 0,
        icon: Star,
        tone: 'green',
      },
      {
        label: 'Báo cáo nhận',
        value: stats?.totalReportsReceived || 0,
        icon: AlertTriangle,
        tone: 'red',
      },
    ],
    [stats]
  );

  const hoursLabel =
    shop?.openTime || shop?.closeTime
      ? `${shop.openTime || '—'} – ${shop.closeTime || '—'}`
      : 'Chưa cấu hình';

  function openWalletHistory() {
    setMainTab('history');
    setHistoryTab('wallet');
  }

  return (
    <div className="admin-detail-page account-detail-page account-detail-page-v2 shop-detail-page-v2">
      <header className="admin-detail-toolbar">
        <button type="button" className="ghost-btn" onClick={() => goBackOr(navigate, '/users')}>
          ← Quay lại
        </button>
        <div className="header-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={loadAccount}
            disabled={loading || actionLoading}
          >
            Làm mới
          </button>
          {user ? (
            isAccountActive ? (
              <button
                type="button"
                className="danger-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('block-account')}
              >
                Khóa tài khoản
              </button>
            ) : (
              <button
                type="button"
                className="approve-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('unblock-account')}
              >
                Mở khóa tài khoản
              </button>
            )
          ) : null}
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {snackbar ? <div className="snackbar">{snackbar}</div> : null}

      {loading ? <DetailSkeleton /> : null}

      {!loading && user ? (
        <>
          <section className="shop-detail-hero">
            <span className={`shop-detail-hero-status ${statusBadgeClass(user.status)}`}>
              {user.statusLabel || (isAccountActive ? 'Hoạt động' : 'Đã khóa')}
            </span>
            <div className="shop-detail-hero-content">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="shop-detail-hero-avatar" />
              ) : (
                <div className="shop-detail-hero-avatar placeholder">
                  {(user.fullName || user.userName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="shop-detail-hero-main">
                <h1>{user.fullName || user.userName || 'Người dùng'}</h1>
                <p className="shop-detail-hero-handle">@{user.userName || ''}</p>
                <p className="shop-detail-hero-meta">
                  <Mail size={14} aria-hidden="true" />
                  {user.email || 'Chưa có email'}
                  <span className="shop-detail-hero-meta-sep">|</span>
                  <Phone size={14} aria-hidden="true" />
                  {user.phone || 'Chưa có SĐT'}
                  <span className="shop-detail-hero-meta-sep">|</span>
                  <CalendarDays size={14} aria-hidden="true" />
                  Tham gia từ {formatJoinDate(user.createdAt)}
                </p>
                <div className="shop-detail-hero-extra shop-detail-hero-follow-row">
                  <FollowStatButton
                    icon={UserPlus}
                    label="Đang theo dõi"
                    count={user.followingCount ?? 0}
                    onClick={() => setFollowDialog('following')}
                  />
                  <FollowStatButton
                    icon={Users}
                    label="Đã theo dõi"
                    count={shop?.followersCount ?? 0}
                    onClick={() => setFollowDialog('followers')}
                  />
                </div>
                <div className="shop-detail-hero-extra">
                  <span className="shop-detail-hero-extra-item">
                    <CalendarDays size={14} aria-hidden="true" />
                    <span>Hoạt động gần nhất:</span>
                    <strong>{formatDate(user.lastActiveAt) || '—'}</strong>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="account-detail-main-section">
            <AdminDetailTabs
              tabs={ACCOUNT_MAIN_TABS}
              activeTab={mainTab}
              onChange={setMainTab}
              variant="underline"
            />

            <div className="account-detail-main-tab-body">
              {mainTab === 'overview' ? (
                <div className="account-detail-overview-tab">
                  <section className="shop-detail-stat-grid account-detail-overview-stats">
                    {statCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <article key={card.label} className={`shop-detail-stat-card tone-${card.tone}`}>
                          <div className="shop-detail-stat-icon">
                            <Icon size={22} aria-hidden="true" />
                          </div>
                          <div>
                            <span className="shop-detail-stat-label">{card.label}</span>
                            <strong className="shop-detail-stat-value">{card.value}</strong>
                            {card.hint ? <em className="shop-detail-stat-hint">{card.hint}</em> : null}
                          </div>
                        </article>
                      );
                    })}
                  </section>

                  <div className="account-detail-overview-cards">
                    <article className="shop-detail-panel shop-detail-info-panel shop-detail-info-panel-compact account-detail-overview-card">
                      <div className="shop-detail-panel-head">
                        <h3>Thông tin người dùng</h3>
                      </div>
                      <dl className="shop-detail-dl account-detail-user-dl">
                        <div>
                          <dt>ID tài khoản</dt>
                          <dd>{user.id || '—'}</dd>
                        </div>
                        <div>
                          <dt>Username</dt>
                          <dd>@{user.userName || '—'}</dd>
                        </div>
                        <div>
                          <dt>Email</dt>
                          <dd>{user.email || '—'}</dd>
                        </div>
                        <div>
                          <dt>Số điện thoại</dt>
                          <dd>{user.phone || '—'}</dd>
                        </div>
                        <div>
                          <dt>Vai trò</dt>
                          <dd>{user.roleLabel || '—'}</dd>
                        </div>
                        <div>
                          <dt>Tạo lúc</dt>
                          <dd>{formatDate(user.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>Cập nhật</dt>
                          <dd>{formatDate(user.updatedAt)}</dd>
                        </div>
                        <div>
                          <dt>Hoạt động gần nhất</dt>
                          <dd>{formatDate(user.lastActiveAt) || '—'}</dd>
                        </div>
                      </dl>
                    </article>

                    <article className="shop-detail-panel account-wallet-panel account-detail-overview-card">
                      <div className="shop-detail-panel-head">
                        <h3>Ví tiền</h3>
                      </div>
                      <div className="account-detail-overview-card-body">
                        <div className="account-wallet-balance-block">
                          <p className="account-wallet-balance-label">Số dư hiện tại</p>
                          <p className="account-wallet-balance-value">
                            {formatPrice(finance?.walletBalance || 0)}
                          </p>
                        </div>
                        <div className="account-wallet-stats account-wallet-stats-stacked">
                          <div>
                            <span>Tổng nạp</span>
                            <strong>{formatPrice(finance?.totalTopup || 0)}</strong>
                          </div>
                          <div>
                            <span>Tổng rút</span>
                            <strong>{formatPrice(finance?.totalWithdrawal || 0)}</strong>
                          </div>
                          <div>
                            <span>Chờ duyệt rút</span>
                            <strong>{formatPrice(finance?.pendingWithdrawTotal || 0)}</strong>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="detail-btn account-wallet-detail-btn"
                        onClick={openWalletHistory}
                      >
                        Xem chi tiết ví
                      </button>
                    </article>

                    {shop ? (
                      <article className="shop-detail-panel account-detail-overview-card">
                        <div className="shop-detail-panel-head">
                          <h3>Gian hàng liên kết</h3>
                          <span className={statusBadgeClass(shop.status)}>{shop.statusLabel}</span>
                        </div>
                        <div className="shop-detail-owner">
                          {resolveMediaUrl(shop.avatar) ? (
                            <img
                              src={resolveMediaUrl(shop.avatar)}
                              alt=""
                              className="shop-detail-owner-avatar"
                            />
                          ) : (
                            <div className="shop-detail-owner-avatar placeholder">
                              {(shop.shopName || shop.shopUsername || 'S').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <strong>{shop.shopName || ''}</strong>
                            <span className="shop-detail-owner-handle">
                              {shop.shopUsername ? `@${shop.shopUsername}` : ''}
                            </span>
                          </div>
                        </div>
                        <dl className="shop-detail-dl compact account-detail-overview-card-body">
                          <div>
                            <dt>Địa chỉ</dt>
                            <dd>{shop.addressHeThong || shop.systemAddress || shop.address || '—'}</dd>
                          </div>
                          <div>
                            <dt>Giờ mở cửa</dt>
                            <dd>{hoursLabel}</dd>
                          </div>
                          <div>
                            <dt>Thống kê</dt>
                            <dd>
                              ★ {shop.averageRating?.toFixed?.(1) || '0.0'} · {shop.totalProducts || 0} SP ·{' '}
                              {shop.followersCount || 0} theo dõi · {shop.soldCount || 0} đã bán
                            </dd>
                          </div>
                        </dl>
                        <Link className="detail-btn shop-detail-side-actions" to={`/shops/${shop.id}`}>
                          Xem gian hàng
                        </Link>
                      </article>
                    ) : (
                      <article className="shop-detail-panel account-detail-overview-card">
                        <div className="shop-detail-panel-head">
                          <h3>Gian hàng liên kết</h3>
                        </div>
                        <p className="muted account-detail-overview-card-body">Người dùng chưa có gian hàng.</p>
                      </article>
                    )}
                  </div>
                </div>
              ) : (
                <ActivityHistorySection
                  entityId={accountId}
                  getIdToken={getIdToken}
                  tabs={detailTabs}
                  tabVariant="underline"
                  panelClassName="account-history-nested shop-detail-history-panel"
                  hideTitle
                  activeTab={historyTab}
                  onTabChange={setHistoryTab}
                />
              )}
            </div>
          </section>
        </>
      ) : null}

      {!loading && !user ? (
        <div className="empty-card">
          Không tìm thấy người dùng.{' '}
          <button type="button" className="link-btn" onClick={() => goBackOr(navigate, '/users')}>
            Quay lại
          </button>
        </div>
      ) : null}

      <FollowListDialog
        open={Boolean(followDialog)}
        type={followDialog}
        entityLabel={user ? `${user.fullName || user.userName || ''} · @${user.userName || ''}` : ''}
        loadPage={loadFollowPage}
        onClose={() => setFollowDialog('')}
      />

      {confirmAction ? (
        <div className="dialog-overlay" role="presentation" onClick={() => !actionLoading && setConfirmAction('')}>
          <div className="dialog-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>
              {confirmAction === 'block-account'
                ? 'Khóa tài khoản'
                : confirmAction === 'unblock-account'
                  ? 'Mở khóa tài khoản'
                  : confirmAction === 'block-shop'
                    ? 'Khóa gian hàng'
                    : 'Mở khóa gian hàng'}
            </h3>
            <p>
              {confirmAction === 'block-account'
                ? 'Người dùng chỉ còn màn bị khóa trên app (rút tiền, khiếu nại, đăng xuất). Gian hàng cũng bị khóa và mọi đơn treo sẽ hủy hoàn cọc.'
                : confirmAction === 'unblock-account'
                  ? 'Tài khoản và gian hàng liên kết sẽ được mở khóa.'
                  : confirmAction === 'block-shop'
                    ? 'Gian hàng sẽ bị khóa: ẩn bài đăng, hủy đơn treo hoàn cọc. Tài khoản vẫn dùng được các tính năng khác trên app.'
                    : 'Gian hàng sẽ hoạt động lại và hiển thị sản phẩm đã ẩn.'}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="ghost-btn"
                disabled={actionLoading}
                onClick={() => setConfirmAction('')}
              >
                Huỷ
              </button>
              <button
                type="button"
                className={
                  confirmAction === 'block-account' || confirmAction === 'block-shop'
                    ? 'danger-btn'
                    : 'approve-btn'
                }
                disabled={actionLoading}
                onClick={handleConfirmAction}
              >
                {actionLoading ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

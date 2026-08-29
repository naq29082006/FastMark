import {
  RESERVATION_STATUS,
  VIEWER_ROLE,
  isDeliveredReservationStatus,
  isActiveDisputeOrder,
  isDisputeResolvedOrder,
  isPostDeliveryDisputeReservation,
  hasSellerPostDeliveryResponse,
} from '../../constants/sellerOrders';
import { reservationRequiresDeposit } from './reservationEntity';

/** Đồng bộ backend/constants — cửa sổ báo cáo / phản hồi tranh chấp pickup. */
export const RESERVATION_DISPUTE_WINDOW_HOURS = 48;
export const DISPUTE_HISTORY_RETENTION_HOURS = 48;
export const RESERVATION_DISPUTE_WINDOW_MS = RESERVATION_DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;
export const DISPUTE_HISTORY_RETENTION_MS = DISPUTE_HISTORY_RETENTION_HOURS * 60 * 60 * 1000;

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

function pickDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isPastPickupTime(item, now = Date.now()) {
  if (!item?.pickupTime) {
    return false;
  }
  const pickup = pickDate(item.pickupTime);
  return Boolean(pickup && now >= pickup.getTime());
}

function computePickupDisputeDeadline(pickupTime) {
  const pickup = pickDate(pickupTime);
  if (!pickup) {
    return null;
  }
  return new Date(pickup.getTime() + RESERVATION_DISPUTE_WINDOW_MS);
}

export function isPostDeliveryEscrowEligible(item) {
  if (!item) {
    return false;
  }
  if (isDeliveredReservationStatus(item.status)) {
    return true;
  }
  return Number(item?.status) === RESERVATION_STATUS.RECEIVED;
}

function isPostDeliveryEscrowStatus(item) {
  if (!item) {
    return false;
  }
  const code = Number(item?.status);
  return (
    code === RESERVATION_STATUS.PICKUP_CONFIRMED ||
    code === RESERVATION_STATUS.RECEIVED ||
    code === RESERVATION_STATUS.COMPLETED ||
    code === RESERVATION_STATUS.AUTO_COMPLETED
  );
}

/** Hạn giữ cọc sau xác nhận giao — tgNhanHang + soNgayKN. */
export function resolveEscrowProtectionDeadline(item) {
  if (!item || !isPostDeliveryEscrowStatus(item) || isDepositAlreadySettled(item)) {
    return null;
  }

  const confirmed = pickDate(
    item?.tgNhanHang || item?.completedAt || item?.deliveredAt
  );
  const days = item?.soNgayKN;
  if (confirmed && days != null) {
    const normalized = Math.min(30, Math.max(1, Math.round(Number(days))));
    return new Date(confirmed.getTime() + normalized * MS_DAY);
  }

  return pickDate(item?.hanGiaiCoc || item?.escrowProtectionDeadlineAt);
}

export function formatEscrowDaysLabel(days) {
  const normalized = Math.min(30, Math.max(1, Math.round(Number(days))));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return '';
  }
  return normalized === 1 ? '1 ngày' : `${normalized} ngày`;
}

export function getPrePickupDisputeWindowText() {
  if (RESERVATION_DISPUTE_WINDOW_HOURS >= 24 && RESERVATION_DISPUTE_WINDOW_HOURS % 24 === 0) {
    const days = RESERVATION_DISPUTE_WINDOW_HOURS / 24;
    return days === 1 ? '1 ngày' : `${days} ngày`;
  }
  return `${RESERVATION_DISPUTE_WINDOW_HOURS} giờ`;
}

export function getPostDeliveryProtectionText(item) {
  if (item?.soNgayKNLabel) {
    return item.soNgayKNLabel;
  }
  if (item?.soNgayKN != null) {
    return formatEscrowDaysLabel(item.soNgayKN);
  }
  return '';
}

/** Escrow / dispute deadline từ API (ưu tiên field countdown mới). */
export function resolveEscrowReleaseAt(item) {
  const postDeliveryDeadline = resolveEscrowProtectionDeadline(item);
  if (postDeliveryDeadline) {
    return postDeliveryDeadline;
  }

  const raw =
    item?.escrowProtectionDeadlineAt ||
    item?.hanGiaiCoc ||
    item?.depositDecisionDeadline ||
    item?.disputeResponseDeadlineAt ||
    item?.disputeReportDeadlineAt ||
    item?.disputeExpireAt ||
    item?.reviewDeadlineAt ||
    item?.autoReleaseAt ||
    null;
  const parsed = pickDate(raw);
  if (parsed) {
    return parsed;
  }
  if (!isPostDeliveryEscrowStatus(item)) {
    return computePickupDisputeDeadline(item?.pickupTime);
  }
  return null;
}

/** Hạn 48h pickup-dispute — không dùng escrow 7 ngày. */
export function resolvePickupDisputeDeadline(item) {
  const pickupBased = computePickupDisputeDeadline(item?.pickupTime);
  const fromApi =
    pickDate(item?.disputeReportDeadlineAt) ||
    pickDate(item?.depositDecisionDeadline);
  if (fromApi && pickupBased) {
    if (Math.abs(fromApi.getTime() - pickupBased.getTime()) <= MS_HOUR) {
      return fromApi;
    }
    if (fromApi.getTime() > pickupBased.getTime() + MS_DAY) {
      return pickupBased;
    }
    return fromApi;
  }
  return fromApi || pickupBased;
}

export function resolveDisputeReportDeadline(item) {
  return resolvePickupDisputeDeadline(item);
}

export function resolveDisputeHistoryVisibleUntil(item) {
  return (
    pickDate(item?.disputeHistoryVisibleUntil) ||
    (() => {
      const settled = pickDate(
        item?.tgGiaiCoc || item?.depositRefundedAt || item?.depositReleasedAt
      );
      if (!settled) {
        return null;
      }
      return new Date(settled.getTime() + DISPUTE_HISTORY_RETENTION_MS);
    })()
  );
}

/** Còn trong hạn khiếu nại / giữ cọc (đồng bộ backend). */
export function isWithinDepositDecisionWindowForItem(item, now = Date.now()) {
  if (item?.withinDepositDecisionWindow === true) {
    return true;
  }
  if (item?.withinDepositDecisionWindow === false) {
    return false;
  }

  if (isPostDeliveryEscrowStatus(item) && !isDepositAlreadySettled(item)) {
    const escrowDeadline = resolveEscrowProtectionDeadline(item);
    if (escrowDeadline) {
      return now < escrowDeadline.getTime();
    }
  }

  const deadline = resolveDisputeReportDeadline(item);
  if (deadline) {
    return now < deadline.getTime();
  }
  if (!item?.pickupTime) {
    return false;
  }
  return now < pickDate(item.pickupTime).getTime() + RESERVATION_DISPUTE_WINDOW_MS;
}

export function isDepositAlreadySettled(item) {
  const settleTo = Number(item?.cocChuyenDen);
  return (
    settleTo === 1 ||
    settleTo === 2 ||
    Boolean(item?.tgGiaiCoc) ||
    Boolean(item?.depositReleasedAt) ||
    Boolean(item?.depositRefundedAt)
  );
}

export function isEscrowHoldActive(item, now = Date.now()) {
  if (!isPostDeliveryEscrowEligible(item)) {
    return false;
  }
  if (isDepositAlreadySettled(item)) {
    return false;
  }
  const deadline = resolveEscrowReleaseAt(item);
  if (!deadline) {
    return false;
  }
  return deadline.getTime() > now;
}

/** Hoàn thành / bảo vệ escrow — ngày, giờ, phút (mục 3). */
export function formatRemainingDuration(releaseAt, now = Date.now()) {
  const deadline = pickDate(releaseAt);
  if (!deadline) {
    return '';
  }
  const diff = deadline.getTime() - now;
  if (diff <= 0) {
    return '';
  }
  const days = Math.floor(diff / MS_DAY);
  if (days >= 1) {
    return `${days} ngày`;
  }
  const hours = Math.floor(diff / MS_HOUR);
  if (hours >= 1) {
    return `${hours} giờ`;
  }
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes} phút`;
}

/** Tranh chấp pickup — giờ / phút (mục 1, 2, 4). */
export function formatDisputeWindowRemaining(releaseAt, now = Date.now()) {
  const deadline = pickDate(releaseAt);
  if (!deadline) {
    return '';
  }
  const diff = deadline.getTime() - now;
  if (diff <= 0) {
    return '';
  }
  const hours = Math.floor(diff / MS_HOUR);
  if (hours >= 1) {
    return `${hours} giờ`;
  }
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes} phút`;
}

export const getRemainingText = (releaseAt, now = Date.now()) => {
  const suffix = formatRemainingDuration(releaseAt, now);
  if (!suffix) {
    return '';
  }
  return `Còn ${suffix}`;
};

export function getEscrowProtectionLabel(item, now = Date.now()) {
  if (!reservationRequiresDeposit(item)) {
    return '';
  }
  if (item?.escrowProtectionCountdownLabel) {
    return item.escrowProtectionCountdownLabel;
  }
  if (!isPostDeliveryEscrowEligible(item) || isDepositAlreadySettled(item)) {
    return '';
  }
  const deadline = resolveEscrowReleaseAt(item);
  if (!deadline) {
    return '';
  }
  const suffix = formatRemainingDuration(deadline, now);
  return suffix ? `Còn ${suffix}` : '';
}

export function formatEscrowHoldRemaining(isoOrDate, now = Date.now()) {
  return getRemainingText(isoOrDate, now);
}

export function getEscrowHoldBadgeLabel(item, now = Date.now()) {
  const label = getEscrowProtectionLabel(item, now);
  return label || '';
}

export function getEscrowHoldDetailLabel(item, now = Date.now()) {
  return getEscrowProtectionLabel(item, now);
}

/** Seller — đếm ngược nhận cọc sau giao hàng. */
export function getSellerDepositReleaseCountdownLabel(item, now = Date.now()) {
  if (!reservationRequiresDeposit(item)) {
    return '';
  }
  const label = getEscrowProtectionLabel(item, now);
  if (!label) {
    return '';
  }
  return `Nhận cọc sau: ${label.replace(/^Còn\s/i, '')}`;
}

/** Post-delivery — shop phản hồi khiếu nại (48h / 2 ngày). */
export function getSellerResponseCountdownLabel(item, now = Date.now()) {
  if (hasSellerPostDeliveryResponse(item)) {
    return '';
  }
  const deadlineRaw = item?.hanPhShop;
  if (!deadlineRaw) {
    return '';
  }
  const suffix = formatDisputeWindowRemaining(deadlineRaw, now);
  if (!suffix) {
    return '';
  }
  return `Còn ${suffix} để phản hồi`;
}

/** Quá giờ nhận — còn thời gian tạo tranh chấp (mục 1). */
export function getPreDisputeReportCountdownLabel(item, now = Date.now()) {
  if (item?.disputeReportCountdownLabel) {
    return item.disputeReportCountdownLabel;
  }
  if (!isPastPickupTime(item, now) || isDepositAlreadySettled(item)) {
    return '';
  }
  if (isActiveDisputeOrder(item)) {
    return '';
  }
  const deadline = resolveDisputeReportDeadline(item);
  const suffix = formatDisputeWindowRemaining(deadline, now);
  return suffix ? `Còn ${suffix}` : '';
}

function getPastPickupReportRemainingSuffix(item, now = Date.now()) {
  const fromApi = String(item?.disputeReportCountdownLabel || '').trim();
  if (fromApi) {
    return fromApi.replace(/^Còn\s/i, '');
  }
  if (!isPastPickupTime(item, now) || isDepositAlreadySettled(item) || isActiveDisputeOrder(item)) {
    return '';
  }
  const deadline = resolveDisputeReportDeadline(item);
  return formatDisputeWindowRemaining(deadline, now);
}

export function isPastPickupPreDisputeWindow(item, now = Date.now()) {
  return (
    Number(item?.status) === RESERVATION_STATUS.WAITING_PICKUP &&
    isPastPickupTime(item, now) &&
    isWithinDepositDecisionWindowForItem(item, now) &&
    !isDepositAlreadySettled(item) &&
    !isActiveDisputeOrder(item)
  );
}

/** Danh sách đơn — quá giờ nhận, còn cửa sổ khiếu nại / báo cáo. */
export function getPastPickupReportListLine(item, viewerRole, now = Date.now()) {
  if (!isPastPickupPreDisputeWindow(item, now)) {
    return '';
  }
  if (viewerRole === VIEWER_ROLE.BUYER && item?.disputeByBuyer) {
    return '';
  }
  if (viewerRole === VIEWER_ROLE.SELLER && item?.disputeBySeller) {
    return '';
  }
  const suffix = getPastPickupReportRemainingSuffix(item, now);
  if (!suffix) {
    return 'Đã quá giờ nhận hàng';
  }
  if (viewerRole === VIEWER_ROLE.SELLER) {
    return `Đã quá giờ nhận hàng, còn ${suffix} để báo cáo`;
  }
  return `Đã quá giờ nhận hàng, còn ${suffix} để khiếu nại`;
}

/** Chi tiết đơn — quá giờ nhận, còn cửa sổ khiếu nại / báo cáo. */
export function getPastPickupReportDetailLine(item, viewerRole, now = Date.now()) {
  if (!isPastPickupPreDisputeWindow(item, now)) {
    return '';
  }
  if (viewerRole === VIEWER_ROLE.BUYER && item?.disputeByBuyer) {
    return '';
  }
  if (viewerRole === VIEWER_ROLE.SELLER && item?.disputeBySeller) {
    return '';
  }
  const suffix = getPastPickupReportRemainingSuffix(item, now);
  if (!suffix) {
    return '';
  }
  if (viewerRole === VIEWER_ROLE.SELLER) {
    return `Còn ${suffix} để báo cáo`;
  }
  return `Còn ${suffix} để khiếu nại`;
}

/** Bên đang xem có nghĩa vụ phản hồi báo cáo của đối phương chưa. */
export function disputeViewerMustRespond(item, viewerRole) {
  if (!item || !viewerRole) {
    return false;
  }
  if (item.disputeByBuyer && item.disputeBySeller) {
    return false;
  }
  const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;
  if (item.disputeByBuyer && !item.disputeBySeller) {
    return !isViewerBuyer;
  }
  if (item.disputeBySeller && !item.disputeByBuyer) {
    return isViewerBuyer;
  }
  return false;
}

/** Pickup-dispute: còn hiện đếm ngược khi một bên đã báo cáo và chưa hết 48h. */
export function shouldShowActiveDisputeCountdown(item, now = Date.now(), viewerRole = null) {
  if (!isActiveDisputeOrder(item)) {
    return false;
  }
  if (isPostDeliveryDisputeReservation(item)) {
    return false;
  }
  if (item.disputeByBuyer && item.disputeBySeller) {
    return false;
  }
  if (!item.disputeByBuyer && !item.disputeBySeller) {
    return false;
  }
  if (viewerRole && !disputeViewerMustRespond(item, viewerRole)) {
    return false;
  }
  const deadline = resolvePickupDisputeDeadline(item);
  return Boolean(deadline && now < deadline.getTime());
}

/** List item — còn bao lâu để bên kia phản hồi. */
export function getDisputeListResponseCountdownLine(item, now = Date.now()) {
  if (!isActiveDisputeOrder(item)) {
    return '';
  }

  if (isPostDeliveryDisputeReservation(item)) {
    if (hasSellerPostDeliveryResponse(item)) {
      return '';
    }
    const deadlineRaw = item?.hanPhShop;
    if (!deadlineRaw) {
      return '';
    }
    const suffix = formatDisputeWindowRemaining(deadlineRaw, now);
    return suffix ? `Còn ${suffix} để phản hồi` : '';
  }

  if (hasBothPartiesDisputeReported(item)) {
    return '';
  }
  if (!item?.disputeByBuyer && !item?.disputeBySeller) {
    return '';
  }

  const deadline = resolvePickupDisputeDeadline(item);
  const suffix = formatDisputeWindowRemaining(deadline, now);
  return suffix ? `Còn ${suffix} để phản hồi` : '';
}

function hasBothPartiesDisputeReported(item) {
  return Boolean(item?.disputeByBuyer && item?.disputeBySeller);
}

/** @deprecated — dùng getDisputeListResponseCountdownLine trên list. */
export function getActiveDisputeResponseCountdownLabel(
  item,
  now = Date.now(),
  viewerRole = null
) {
  if (!shouldShowActiveDisputeCountdown(item, now, viewerRole)) {
    return '';
  }
  const deadline = resolvePickupDisputeDeadline(item);
  const suffix = formatDisputeWindowRemaining(deadline, now);
  if (!suffix) {
    return '';
  }
  const party =
    viewerRole === VIEWER_ROLE.SELLER ? 'Người bán' : 'Người mua';
  return `${party} còn ${suffix} để phản hồi`;
}

/** Nhãn nút báo cáo/phản hồi trên tranh chấp pickup — đối phương đã khiếu nại trước. */
export function getDisputeActionButtonLabel(item, viewerRole, now = Date.now()) {
  if (shouldShowActiveDisputeCountdown(item, now, viewerRole)) {
    return 'Phản hồi';
  }
  return 'Báo cáo';
}

/** Countdown trên tab tranh chấp (chỉ pickup-dispute một bên đã báo). */
export function getDisputeTabCountdownLine(item, now = Date.now(), viewerRole = null) {
  return getActiveDisputeResponseCountdownLabel(item, now, viewerRole);
}

/** Tranh chấp đã xử lý — giữ lịch sử 48h (mục 4). */
export function getResolvedDisputeRetentionLabel(item, now = Date.now()) {
  if (item?.disputeHistoryCountdownLabel) {
    return item.disputeHistoryCountdownLabel;
  }
  if (!isDisputeResolvedOrder(item)) {
    return '';
  }
  const until = resolveDisputeHistoryVisibleUntil(item);
  const suffix = formatDisputeWindowRemaining(until, now);
  return suffix ? `Kết quả tranh chấp sẽ lưu thêm ${suffix}` : '';
}

/** @deprecated — dùng getPreDisputeReportCountdownLabel hoặc getActiveDisputeResponseCountdownLabel */
export function getDisputeCountdownLabel(item, now = Date.now()) {
  if (isActiveDisputeOrder(item)) {
    return getActiveDisputeResponseCountdownLabel(item, now);
  }
  return getPreDisputeReportCountdownLabel(item, now);
}

export function getBuyerDisputeDeadlineDetailLabel(item, now = Date.now()) {
  const label = getPreDisputeReportCountdownLabel(item, now);
  if (!label) {
    return '';
  }
  return `Thời hạn khiếu nại: ${label.replace(/^Còn\s/i, 'còn ')}`;
}

/** Buyer — thời gian còn lại khiếu nại sau nhận hàng (màn chi tiết). */
export function getBuyerEscrowComplaintCountdownLabel(item, now = Date.now()) {
  if (!isPostDeliveryEscrowEligible(item) || isDepositAlreadySettled(item)) {
    return '';
  }
  const label = getEscrowProtectionLabel(item, now);
  return label ? `${label} để khiếu nại` : '';
}

/** Seller — thời gian còn lại nhận cọc sau giao hàng (màn chi tiết). */
export function getSellerDepositReleaseDetailCountdownLabel(item, now = Date.now()) {
  if (!reservationRequiresDeposit(item)) {
    return '';
  }
  if (!isPostDeliveryEscrowEligible(item) || isDepositAlreadySettled(item)) {
    return '';
  }
  const label = getEscrowProtectionLabel(item, now);
  return label ? `${label} để nhận cọc` : '';
}

/** Nhãn countdown thống nhất cho thẻ đơn / chi tiết. */
export function getOrderCountdownLine(item, now = Date.now(), viewerRole = null) {
  if (isDisputeResolvedOrder(item)) {
    return '';
  }
  if (isActiveDisputeOrder(item)) {
    return getDisputeTabCountdownLine(item, now, viewerRole);
  }
  if (isPastPickupPreDisputeWindow(item, now)) {
    return getPastPickupReportListLine(item, viewerRole, now);
  }
  if (isPostDeliveryEscrowEligible(item) && isEscrowHoldActive(item, now)) {
    return getEscrowProtectionLabel(item, now);
  }
  return '';
}

export function findNextEscrowDeadline(items, now = Date.now()) {
  let nearest = null;
  for (const item of items || []) {
    if (!isEscrowHoldActive(item, now)) {
      continue;
    }
    const deadlineAt = resolveEscrowReleaseAt(item)?.getTime();
    if (!Number.isFinite(deadlineAt) || deadlineAt <= now) {
      continue;
    }
    if (nearest == null || deadlineAt < nearest) {
      nearest = deadlineAt;
    }
  }
  return nearest;
}

export { isPastPickupTime };

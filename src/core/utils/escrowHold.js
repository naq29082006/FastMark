import {
  RESERVATION_STATUS,
  isDeliveredReservationStatus,
} from '../../constants/sellerOrders';

function isPostDeliveryEscrowEligible(item) {
  if (!item) {
    return false;
  }
  if (isDeliveredReservationStatus(item.status)) {
    return true;
  }
  return Number(item?.status) === RESERVATION_STATUS.RECEIVED;
}

/** Còn trong hạn khiếu nại / giữ cọc (đồng bộ backend depositDecisionDeadline). */
export function isWithinDepositDecisionWindowForItem(item, now = Date.now()) {
  if (item?.withinDepositDecisionWindow === true) {
    return true;
  }
  if (item?.withinDepositDecisionWindow === false) {
    return false;
  }
  const deadline =
    resolveEscrowReleaseAt(item) ||
    (item?.depositDecisionDeadline ? new Date(item.depositDecisionDeadline) : null);
  if (deadline && Number.isFinite(deadline.getTime())) {
    return now < deadline.getTime();
  }
  if (!item?.pickupTime) {
    return false;
  }
  const pickup = new Date(item.pickupTime);
  if (!Number.isFinite(pickup.getTime())) {
    return false;
  }
  return now < pickup.getTime() + 24 * 60 * 60 * 1000;
}

export function resolveEscrowReleaseAt(item) {
  const raw =
    item?.escrowReleaseAt ||
    item?.depositDecisionDeadline ||
    item?.disputeExpireAt ||
    item?.reviewDeadlineAt ||
    item?.autoReleaseAt ||
    null;
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function isDepositAlreadySettled(item) {
  const settleTo = Number(item?.depositSettleTo);
  return (
    settleTo === 1 ||
    settleTo === 2 ||
    Boolean(item?.depositSettledAt) ||
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

export const getRemainingText = (releaseAt, now = Date.now()) => {
  const suffix = formatRemainingDuration(releaseAt, now);
  if (!suffix) {
    const deadline = releaseAt instanceof Date ? releaseAt : new Date(releaseAt);
    if (!Number.isFinite(deadline.getTime())) {
      return '';
    }
    const diff = deadline.getTime() - now;
    if (diff <= 0) {
      return 'Đã giải ngân';
    }
    return '';
  }
  return `Còn ${suffix}`;
};

/** Phần thời gian còn lại: "5 ngày" | "5 giờ" | "34 phút" (không có tiền tố "Còn"). */
export function formatRemainingDuration(releaseAt, now = Date.now()) {
  const deadline = releaseAt instanceof Date ? releaseAt : new Date(releaseAt);
  if (!Number.isFinite(deadline.getTime())) {
    return '';
  }

  const diff = deadline.getTime() - now;
  if (diff <= 0) {
    return '';
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days >= 1) {
    return `${days} ngày`;
  }

  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours >= 1) {
    return `${hours} giờ`;
  }

  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes} phút`;
}

export function getEscrowProtectionLabel(item, now = Date.now()) {
  if (!isPostDeliveryEscrowEligible(item)) {
    return '';
  }
  if (isDepositAlreadySettled(item)) {
    return '';
  }
  const deadline = resolveEscrowReleaseAt(item);
  if (!deadline) {
    return '';
  }
  return getRemainingText(deadline, now);
}

export function formatEscrowHoldRemaining(isoOrDate, now = Date.now()) {
  return getRemainingText(isoOrDate, now);
}

export function getEscrowHoldBadgeLabel(item, now = Date.now()) {
  const label = getEscrowProtectionLabel(item, now);
  if (!label || label === 'Đã giải ngân') {
    return '';
  }
  return label;
}

export function getEscrowHoldDetailLabel(item, now = Date.now()) {
  return getEscrowProtectionLabel(item, now);
}

/** Seller — đếm ngược nhận cọc sau giao hàng (tab Hoàn thành / chi tiết đơn). */
export function getSellerDepositReleaseCountdownLabel(item, now = Date.now()) {
  if (!isPostDeliveryEscrowEligible(item)) {
    return '';
  }
  if (isDepositAlreadySettled(item)) {
    return '';
  }
  const deadline = resolveEscrowReleaseAt(item);
  if (!deadline) {
    return '';
  }
  const suffix = formatRemainingDuration(deadline, now);
  if (!suffix) {
    return '';
  }
  return `Nhận cọc sau: ${suffix}`;
}

export function getSellerResponseCountdownLabel(item, now = Date.now()) {
  const deadlineRaw = item?.sellerResponseDeadlineAt;
  if (!deadlineRaw) {
    return '';
  }
  const deadline = new Date(deadlineRaw);
  if (!Number.isFinite(deadline.getTime())) {
    return '';
  }
  const text = getRemainingText(deadline, now);
  if (!text) {
    return '';
  }
  if (text === 'Đã giải ngân') {
    return 'Đã hết thời hạn phản hồi';
  }
  return `${text} để phản hồi`;
}

export function getDisputeCountdownLabel(item, now = Date.now()) {
  const deadline = resolveEscrowReleaseAt(item);
  if (!deadline) {
    return '';
  }
  return getRemainingText(deadline, now);
}

/** Buyer chi tiết đơn — dòng dưới mã đơn hàng. */
export function getBuyerDisputeDeadlineDetailLabel(item, now = Date.now()) {
  const remaining = getDisputeCountdownLabel(item, now);
  if (!remaining || remaining === 'Đã giải ngân') {
    return '';
  }
  const suffix = remaining.replace(/^Còn\s/i, 'còn ');
  return `Thời hạn khiếu nại: ${suffix}`;
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

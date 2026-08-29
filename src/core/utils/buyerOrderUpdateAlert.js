import { Alert } from 'react-native';

import {
  RESERVATION_STATUS,
  isCancelledReservationStatus,
  isDeliveredReservationStatus,
} from '../../constants/sellerOrders';

/** Chỉ hiện popup trên màn mã QR nhận hàng (người mua). */
export const BUYER_PICKUP_QR_NOTIFY_ACTIONS = new Set([
  'completed',
  'seller_cancelled',
  'quantity_adjusted',
]);

const ALERT_COPY = {
  completed: {
    title: 'Đơn hoàn thành',
    message: 'Shop đã xác nhận giao hàng. Đơn của bạn đã hoàn thành.',
  },
  seller_cancelled: {
    title: 'Đơn đã hủy',
    message: 'Người bán đã hủy đơn giữ hàng. Tiền cọc (nếu có) sẽ được hoàn về ví.',
  },
};

const PICKUP_QR_ALERT_DEDUPE_MS = 4000;
const recentPickupQrAlertKeys = new Map();

function buildQuantityAdjustedMessage(payload) {
  const from = Number(payload?.previousQuantity);
  const to = Number(payload?.newQuantity);
  const qtyLine =
    Number.isFinite(from) && Number.isFinite(to)
      ? `Shop đã điều chỉnh số lượng ${from} → ${to}.`
      : 'Shop đã điều chỉnh số lượng đơn giữ hàng.';
  return `${qtyLine} Số lượng, tiền cọc và tổng tiền trên màn hình đã được cập nhật.`;
}

function buildPickupQrAlertDedupeKey(reservationId, action, payload) {
  return [
    String(reservationId || ''),
    action,
    payload?.previousQuantity ?? '',
    payload?.newQuantity ?? '',
    payload?.status ?? '',
  ].join(':');
}

function shouldSkipDuplicatePickupQrAlert(reservationId, action, payload) {
  const key = buildPickupQrAlertDedupeKey(reservationId, action, payload);
  const now = Date.now();
  const lastAt = recentPickupQrAlertKeys.get(key);
  if (lastAt != null && now - lastAt < PICKUP_QR_ALERT_DEDUPE_MS) {
    return true;
  }
  recentPickupQrAlertKeys.set(key, now);
  if (recentPickupQrAlertKeys.size > 40) {
    for (const [storedKey, storedAt] of recentPickupQrAlertKeys) {
      if (now - storedAt > PICKUP_QR_ALERT_DEDUPE_MS * 2) {
        recentPickupQrAlertKeys.delete(storedKey);
      }
    }
  }
  return false;
}

export function resolvePickupQrAlertAction(payload) {
  const action = String(payload?.action || '').trim();
  if (BUYER_PICKUP_QR_NOTIFY_ACTIONS.has(action)) {
    return action;
  }
  const status = Number(payload?.status);
  if (Number.isFinite(status)) {
    if (isCancelledReservationStatus(status)) {
      return 'seller_cancelled';
    }
    if (isDeliveredReservationStatus(status)) {
      return 'completed';
    }
  }
  return '';
}

export function shouldShowBuyerPickupQrAlert(payload) {
  return Boolean(resolvePickupQrAlertAction(payload));
}

export function showBuyerPickupQrOrderAlert(payload, { reservationId } = {}) {
  const action = resolvePickupQrAlertAction(payload);
  if (!action) {
    return;
  }
  if (shouldSkipDuplicatePickupQrAlert(reservationId, action, payload)) {
    return;
  }

  if (action === 'quantity_adjusted') {
    Alert.alert('Điều chỉnh số lượng', buildQuantityAdjustedMessage(payload));
    return;
  }

  const preset = ALERT_COPY[action];
  if (preset) {
    Alert.alert(preset.title, preset.message);
  }
}

/** Sau khi fetch đơn mới — báo hủy/hoàn thành/điều chỉnh SL (khi socket thiếu action). */
export function showBuyerPickupQrAlertFromStatusTransition(
  previousReservation,
  nextReservation,
  reservationId
) {
  const prevStatus = Number(previousReservation?.status);
  const nextStatus = Number(nextReservation?.status);

  if (
    prevStatus === RESERVATION_STATUS.WAITING_PICKUP &&
    nextStatus === RESERVATION_STATUS.WAITING_PICKUP
  ) {
    const prevQty = Number(previousReservation?.quantity);
    const nextQty = Number(nextReservation?.quantity);
    if (
      Number.isFinite(prevQty) &&
      Number.isFinite(nextQty) &&
      prevQty !== nextQty &&
      nextQty < prevQty
    ) {
      showBuyerPickupQrOrderAlert(
        {
          action: 'quantity_adjusted',
          previousQuantity: prevQty,
          newQuantity: nextQty,
        },
        { reservationId }
      );
      return;
    }
  }

  if (prevStatus !== RESERVATION_STATUS.WAITING_PICKUP) {
    return;
  }
  if (isCancelledReservationStatus(nextStatus)) {
    showBuyerPickupQrOrderAlert(
      { action: 'seller_cancelled', status: nextStatus },
      { reservationId }
    );
    return;
  }
  if (isDeliveredReservationStatus(nextStatus)) {
    showBuyerPickupQrOrderAlert({ action: 'completed', status: nextStatus }, { reservationId });
  }
}

function enrichQuantityAdjustedPayload(base, previousReservation, nextReservation) {
  if (String(base?.action || '').trim() !== 'quantity_adjusted') {
    return base;
  }
  const enriched = { ...base };
  if (!Number.isFinite(Number(enriched.previousQuantity)) && previousReservation) {
    enriched.previousQuantity = previousReservation.quantity;
  }
  if (!Number.isFinite(Number(enriched.newQuantity)) && nextReservation) {
    enriched.newQuantity = nextReservation.quantity;
  }
  return enriched;
}

export function buildPickupQrAlertPayloadFromDiff(previousReservation, nextReservation, socketPayload) {
  const base = enrichQuantityAdjustedPayload(
    { ...(socketPayload || {}) },
    previousReservation,
    nextReservation
  );
  const resolvedAction = resolvePickupQrAlertAction(base);
  if (resolvedAction) {
    return base;
  }
  const prevStatus = Number(previousReservation?.status);
  const nextStatus = Number(nextReservation?.status ?? base.status);
  if (
    prevStatus === RESERVATION_STATUS.WAITING_PICKUP &&
    nextStatus === RESERVATION_STATUS.WAITING_PICKUP
  ) {
    const prevQty = Number(previousReservation?.quantity);
    const nextQty = Number(nextReservation?.quantity);
    if (
      Number.isFinite(prevQty) &&
      Number.isFinite(nextQty) &&
      prevQty !== nextQty &&
      nextQty < prevQty
    ) {
      return {
        ...base,
        action: 'quantity_adjusted',
        previousQuantity: prevQty,
        newQuantity: nextQty,
        status: nextStatus,
      };
    }
  }
  if (nextReservation?.status != null) {
    return { ...base, status: nextReservation.status };
  }
  return base;
}

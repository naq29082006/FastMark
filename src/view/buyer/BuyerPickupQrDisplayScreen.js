import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getBuyerReservationOnBackend } from '../../api/buyerOpsApi';
import {
  RESERVATION_STATUS,
  isCancelledReservationStatus,
  isDeliveredReservationStatus,
} from '../../constants/sellerOrders';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import {
  buildPickupQrAlertPayloadFromDiff,
  resolvePickupQrAlertAction,
  shouldShowBuyerPickupQrAlert,
  showBuyerPickupQrAlertFromStatusTransition,
  showBuyerPickupQrOrderAlert,
} from '../../core/utils/buyerOrderUpdateAlert';
import { coalesceReservationFetch } from '../../core/utils/coalesceReservationFetch';
import { buildQrImageUrl, resolvePickupQrPayload } from '../../core/utils/pickupQr';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { PickupOrderSummaryCard } from '../shared/components/PickupOrderLayout';

const QR_IMAGE_SIZE = 280;
const QR_RENDER_SIZE = 220;
const SOCKET_REFRESH_RETRY_MS = 450;
const PICKUP_QR_POLL_MS = 15000;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function needsPickupQrRefreshRetry(action, previousReservation, nextReservation) {
  if (!action || !previousReservation || !nextReservation) {
    return false;
  }
  if (action === 'completed') {
    return !isDeliveredReservationStatus(nextReservation.status);
  }
  if (action === 'seller_cancelled') {
    return !isCancelledReservationStatus(nextReservation.status);
  }
  if (action === 'quantity_adjusted') {
    const prevQty = Number(previousReservation.quantity);
    const nextQty = Number(nextReservation.quantity);
    return Number.isFinite(prevQty) && Number.isFinite(nextQty) && prevQty === nextQty;
  }
  return false;
}

function resolvePickupStatus(reservation) {
  const status = Number(reservation?.status);
  if (isCancelledReservationStatus(status)) {
    return { label: 'Đã hủy', tone: 'cancelled' };
  }
  if (isDeliveredReservationStatus(status)) {
    return { label: 'Hoàn thành', tone: 'completed' };
  }
  if (status === RESERVATION_STATUS.WAITING_PICKUP) {
    return { label: 'Chờ nhận hàng', tone: 'waiting' };
  }
  return { label: 'Chờ nhận hàng', tone: 'waiting' };
}

export default function BuyerPickupQrDisplayScreen({
  reservation: initialReservation,
  onBack,
  onReservationUpdated,
}) {
  const insets = useScreenInsets();
  const [reservation, setReservation] = useState(initialReservation);
  const reservationRef = useRef(initialReservation);
  const reservationId = reservation?.id;

  useEffect(() => {
    setReservation(initialReservation);
    reservationRef.current = initialReservation;
  }, [initialReservation]);

  useEffect(() => {
    reservationRef.current = reservation;
  }, [reservation]);

  const refreshReservation = useCallback(async ({ notifyTransition = false } = {}) => {
    if (!reservationId) {
      return null;
    }
    try {
      return await coalesceReservationFetch('buyer', reservationId, async () => {
        const idToken = await getCurrentUserIdToken();
        if (!idToken) {
          return null;
        }
        const updated = await getBuyerReservationOnBackend(idToken, reservationId);
        if (updated) {
          const previous = reservationRef.current;
          reservationRef.current = updated;
          setReservation(updated);
          onReservationUpdated?.(updated);
          if (notifyTransition) {
            showBuyerPickupQrAlertFromStatusTransition(previous, updated, reservationId);
          }
        }
        return updated || null;
      });
    } catch (error) {
      console.warn('refresh pickup qr reservation failed:', error?.message || error);
      return null;
    }
  }, [onReservationUpdated, reservationId]);

  const handleOrderUpdated = useCallback(
    async (payload) => {
      if (!payload?.reservationId || String(payload.reservationId) !== String(reservationId)) {
        return;
      }
      const previousSnapshot = reservationRef.current;
      const socketAction = resolvePickupQrAlertAction(payload);
      let updated = await refreshReservation({ notifyTransition: false });

      if (
        socketAction &&
        needsPickupQrRefreshRetry(socketAction, previousSnapshot, updated)
      ) {
        await delay(SOCKET_REFRESH_RETRY_MS);
        updated = (await refreshReservation({ notifyTransition: false })) || updated;
      }

      const alertPayload = buildPickupQrAlertPayloadFromDiff(
        previousSnapshot,
        updated,
        {
          ...payload,
          status: payload?.status ?? updated?.status,
        }
      );
      if (shouldShowBuyerPickupQrAlert(alertPayload)) {
        showBuyerPickupQrOrderAlert(alertPayload, { reservationId });
      }
    },
    [refreshReservation, reservationId]
  );

  useOrderSocket({
    enabled: Boolean(reservationId),
    onOrderUpdated: handleOrderUpdated,
  });

  useEffect(() => {
    if (
      !reservationId ||
      isDeliveredReservationStatus(reservation?.status) ||
      isCancelledReservationStatus(reservation?.status)
    ) {
      return undefined;
    }
    const interval = setInterval(
      () => refreshReservation({ notifyTransition: true }),
      PICKUP_QR_POLL_MS
    );
    return () => clearInterval(interval);
  }, [refreshReservation, reservation?.status, reservationId]);

  const qrPayload = useMemo(() => resolvePickupQrPayload(reservation), [reservation]);
  const qrImageUrl = qrPayload ? buildQrImageUrl(qrPayload, QR_IMAGE_SIZE) : '';
  const isWaitingPickup = Number(reservation?.status) === RESERVATION_STATUS.WAITING_PICKUP;

  const productName = reservation?.product?.productName || 'Sản phẩm';
  const variantName = String(reservation?.variant?.variantName || '').trim();
  const productImage =
    reservation?.product?.thumbnail ||
    reservation?.variant?.imageUrl ||
    reservation?.product?.thumbnails?.[0] ||
    '';
  const qty = Number(reservation?.quantity) || 1;
  const totalAmount = Number(reservation?.totalAmount) || 0;
  const depositAmount = Number(reservation?.depositAmount) || 0;
  const cashDue = Math.max(
    0,
    Number(reservation?.remainingAmount ?? reservation?.cashDue) || totalAmount - depositAmount
  );
  const unitPrice =
    reservation?.agreedPrice != null
      ? Number(reservation.agreedPrice)
      : reservation?.variant?.price != null
        ? Number(reservation.variant.price)
        : qty > 0
          ? Math.round(totalAmount / qty)
          : 0;
  const note = String(reservation?.note || '').trim();
  const pickupStatus = resolvePickupStatus(reservation);

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Mã nhận hàng" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.nestedScrollPaddingBottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isWaitingPickup ? (
          <View style={styles.qrCard}>
            {qrImageUrl ? (
              <Image source={{ uri: qrImageUrl }} style={styles.qrImage} />
            ) : (
              <ActivityIndicator color={t.primary} size="small" />
            )}
          </View>
        ) : null}

        <PickupOrderSummaryCard
          key={`${reservation?.status}-${qty}-${totalAmount}-${depositAmount}`}
          productImage={productImage}
          productName={productName}
          variantName={variantName}
          unitPrice={unitPrice}
          qty={qty}
          totalAmount={totalAmount}
          depositAmount={depositAmount}
          cashDue={cashDue}
          pickupTime={reservation?.pickupTime}
          note={note}
          statusBadge={pickupStatus}
        />

        <Text style={styles.footerHint}>
          {pickupStatus.tone === 'completed'
            ? 'Shop đã quét mã và xác nhận giao hàng.'
            : pickupStatus.tone === 'cancelled'
              ? 'Đơn đã bị hủy. Tiền cọc (nếu có) sẽ được hoàn về ví của bạn.'
              : 'Đưa mã QR cho shop quét khi nhận hàng. Kiểm tra số tiền cần trả trước khi nhận.'}
        </Text>

        <Pressable style={styles.doneBtn} onPress={onBack}>
          <Text style={styles.doneBtnText}>Đóng</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  qrCard: {
    width: '100%',
    minHeight: 248,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    paddingVertical: 16,
  },
  qrImage: {
    width: QR_RENDER_SIZE,
    height: QR_RENDER_SIZE,
    borderRadius: 8,
  },
  footerHint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  doneBtn: {
    alignSelf: 'stretch',
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: t.primary,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
});

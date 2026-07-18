import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CircularBackButton from '../shared/components/CircularBackButton';
import {
  cancelBuyerReservationOnBackend,
  getBuyerReservationOnBackend,
} from '../../api/buyerOpsApi';
import { RESERVATION_STATUS } from '../../constants/sellerOrders';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { formatOrderCode } from '../../core/utils/orderCode';
import { formatPrice } from '../../core/utils/productFormat';

const RESERVATION_STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING]: 'Chờ xác nhận',
  [RESERVATION_STATUS.CONFIRMED]: 'Đã xác nhận',
  [RESERVATION_STATUS.COMPLETED]: 'Hoàn thành',
  [RESERVATION_STATUS.CANCELLED]: 'Đã hủy',
};

function formatDateTime(iso) {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailRow({ label, value, emphasize = false }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasize && styles.rowValueEmphasize]}>{value}</Text>
    </View>
  );
}

function pickStoreName(...candidates) {
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '—';
}

function mergeLoadedItem(previous, next) {
  if (!next) {
    return previous;
  }
  const prev = previous || {};
  return {
    ...prev,
    ...next,
    id: next.id || prev.id,
    shopId: next.shopId || prev.shopId || '',
    storeName: pickStoreName(next.storeName, prev.storeName, next.shopUsername, prev.shopUsername),
    shopUsername: next.shopUsername || prev.shopUsername || '',
    productName: next.productName || prev.productName || next.product?.productName || '',
    product: next.product || prev.product || null,
    variant: next.variant || prev.variant || null,
  };
}

export default function BuyerOrderDetailScreen({
  orderId,
  initialItem = null,
  onBack,
  onChanged,
  onNavigatePickup,
  onReviewStore,
  canReview = false,
}) {
  const resolvedId = String(orderId || initialItem?.id || '').trim();
  const [item, setItem] = useState(initialItem);
  const [isLoading, setIsLoading] = useState(!initialItem);
  const [error, setError] = useState('');
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    if (!resolvedId) {
      setError('Thiếu mã đơn hàng.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const reservation = await getBuyerReservationOnBackend(idToken, resolvedId);
      setItem((prev) => mergeLoadedItem(prev, reservation));
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết đơn.');
      setItem((prev) => prev || initialItem);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedId, initialItem]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading && !item) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <CircularBackButton onPress={onBack} variant="light" />
          <Text style={styles.title}>Chi tiết đơn hàng</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <CircularBackButton onPress={onBack} variant="light" />
          <Text style={styles.title}>Chi tiết đơn hàng</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <Text style={styles.errorText}>{error || 'Không tìm thấy đơn.'}</Text>
      </View>
    );
  }

  const reservation = item;
  const canCancel =
    reservation.status === RESERVATION_STATUS.PENDING && !reservation.buyerCancelLocked;
  const canNavigate = reservation.status === RESERVATION_STATUS.CONFIRMED;

  async function handleCancel() {
    Alert.alert('Hủy giữ hàng', 'Bạn có chắc muốn hủy yêu cầu giữ hàng này?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: async () => {
          setIsActing(true);
          try {
            const idToken = await getCurrentUserIdToken();
            await cancelBuyerReservationOnBackend(idToken, reservation.id);
            onChanged?.();
            onBack?.();
          } catch (actionError) {
            Alert.alert('Lỗi', actionError.message || 'Không hủy được đơn.');
          } finally {
            setIsActing(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <CircularBackButton onPress={onBack} variant="light" />
        <Text style={styles.title}>Chi tiết đơn hàng</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.card}>
          <Text style={styles.codeLabel}>Mã đơn hàng</Text>
          <Text style={styles.code}>{formatOrderCode(reservation.id || resolvedId)}</Text>

          <DetailRow
            label="Trạng thái"
            value={RESERVATION_STATUS_LABELS[reservation.status] || 'Không rõ'}
          />
          <DetailRow label="Sản phẩm" value={reservation.product?.productName || '—'} />
          <DetailRow label="Phân loại" value={reservation.variant?.variantName || '—'} />
          <DetailRow
            label="Gian hàng"
            value={pickStoreName(
              reservation.storeName,
              reservation.shop?.shopName,
              reservation.shopUsername
            )}
          />
          <DetailRow label="Số lượng" value={String(reservation.quantity || 0)} />
          <DetailRow label="Đơn giá" value={formatPrice(reservation.agreedPrice)} />
          <DetailRow label="Tổng tiền" value={formatPrice(reservation.totalAmount)} emphasize />
          <DetailRow label="Giờ lấy hàng" value={formatDateTime(reservation.pickupTime)} />
          <DetailRow label="Tạo lúc" value={formatDateTime(reservation.createdAt)} />
          {reservation.confirmedAt ? (
            <DetailRow label="Xác nhận" value={formatDateTime(reservation.confirmedAt)} />
          ) : null}
          {reservation.completedAt ? (
            <DetailRow label="Hoàn thành" value={formatDateTime(reservation.completedAt)} />
          ) : null}
          {reservation.cancelledAt ? (
            <DetailRow label="Hủy lúc" value={formatDateTime(reservation.cancelledAt)} />
          ) : null}
          {reservation.cancelReason ? (
            <DetailRow label="Lý do hủy" value={reservation.cancelReason} />
          ) : null}
          {reservation.note ? <DetailRow label="Ghi chú" value={reservation.note} /> : null}
        </View>

        {reservation.status === RESERVATION_STATUS.CONFIRMED &&
        (reservation.qrPayload || reservation.pickupCode) ? (
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Mã nhận hàng</Text>
            <Text style={styles.qrHint}>
              Đưa mã này cho shop quét khi bạn đến lấy hàng.
            </Text>
            {reservation.qrPayload ? (
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
                    reservation.qrPayload
                  )}`,
                }}
                style={styles.qrImage}
              />
            ) : null}
            <Text style={styles.pickupCode}>{reservation.pickupCode || '—'}</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actionCol}>
          {canNavigate ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              disabled={isActing}
              onPress={() =>
                onNavigatePickup?.({
                  shopId: reservation.shopId,
                  reservationId: String(reservation.id),
                  storeName: reservation.storeName,
                })
              }
            >
              <Text style={styles.actionBtnText}>🧭 Đến lấy hàng</Text>
            </Pressable>
          ) : null}
          {canCancel ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              disabled={isActing}
              onPress={handleCancel}
            >
              <Text style={styles.actionBtnTextDanger}>Hủy giữ hàng</Text>
            </Pressable>
          ) : null}
          {canReview ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              disabled={isActing}
              onPress={() =>
                onReviewStore?.({
                  storeId: reservation.shopId ? String(reservation.shopId) : '',
                  storeName: reservation.storeName,
                  productName: reservation.product?.productName,
                  orderCode: reservation.id ? String(reservation.id) : '',
                })
              }
            >
              <Text style={styles.actionBtnTextSecondary}>⭐ Đánh giá</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#076F32',
  },
  title: {
    flex: 1,
    marginHorizontal: 12,
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBarSpacer: { width: 36 },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7D9B8',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#055528',
    marginBottom: 6,
  },
  qrHint: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  qrImage: {
    width: 220,
    height: 220,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
  },
  pickupCode: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#076F32',
  },
  codeLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  code: {
    marginTop: 4,
    marginBottom: 12,
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rowLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  rowValueEmphasize: {
    color: '#076F32',
    fontWeight: '900',
  },
  actionCol: {
    marginTop: 16,
    gap: 10,
  },
  actionBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionBtnPrimary: {
    backgroundColor: '#076F32',
  },
  actionBtnSecondary: {
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  actionBtnDanger: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnTextSecondary: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnTextDanger: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 12,
    color: '#b91c1c',
    fontWeight: '700',
  },
});

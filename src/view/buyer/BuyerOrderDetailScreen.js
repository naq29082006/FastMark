import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CircularBackButton from '../shared/components/CircularBackButton';
import {
  acceptBuyerCounterOnBackend,
  cancelBuyerReservationOnBackend,
  getBuyerDealOnBackend,
  getBuyerReservationOnBackend,
} from '../../api/buyerOpsApi';
import { DEAL_OFFER_STATUS, DEAL_OFFER_BY, RESERVATION_STATUS } from '../../constants/sellerOrders';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { formatOrderCode } from '../../core/utils/orderCode';
import { formatPrice } from '../../core/utils/productFormat';

const DEAL_STATUS_LABELS = {
  [DEAL_OFFER_STATUS.PENDING]: 'Đang chờ',
  [DEAL_OFFER_STATUS.ACCEPTED]: 'Đã chấp nhận',
  [DEAL_OFFER_STATUS.REJECTED]: 'Đã từ chối',
};

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

function resolveDealTotals(deal) {
  const qty = Number(deal?.quantity) || 1;
  const originalUnit = Number(deal?.originalPrice) || 0;
  const originalTotal = originalUnit * qty;
  let offeredTotal = Number(deal?.offeredPrice) || 0;
  if (originalUnit > 0 && offeredTotal > 0 && offeredTotal <= originalUnit) {
    offeredTotal *= qty;
  }
  const lastOfferBy = Number(deal?.lastOfferBy) || DEAL_OFFER_BY.BUYER;
  return { qty, originalTotal, offeredTotal, lastOfferBy };
}

function getDealOfferLabel(status, lastOfferBy) {
  const fromSeller = lastOfferBy === DEAL_OFFER_BY.SELLER;
  if (status === DEAL_OFFER_STATUS.ACCEPTED) {
    return fromSeller ? 'Bạn đã chấp nhận' : 'Shop đã chấp nhận';
  }
  return fromSeller ? 'Giá shop đề nghị' : 'Giá bạn đề nghị';
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
  kind,
  orderId,
  initialItem = null,
  onBack,
  onChanged,
  onReserveFromDeal,
  onNavigatePickup,
  onReviewStore,
  onCounterDeal,
  onResubmitDeal,
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
      if (kind === 'deal') {
        const deal = await getBuyerDealOnBackend(idToken, resolvedId);
        setItem((prev) => mergeLoadedItem(prev, deal));
      } else {
        const reservation = await getBuyerReservationOnBackend(idToken, resolvedId);
        setItem((prev) => mergeLoadedItem(prev, reservation));
      }
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết đơn.');
      setItem((prev) => prev || initialItem);
    } finally {
      setIsLoading(false);
    }
  }, [kind, resolvedId, initialItem]);

  useEffect(() => {
    load();
  }, [load]);

  const title = kind === 'deal' ? 'Chi tiết deal giá' : 'Chi tiết đơn hàng';

  if (isLoading && !item) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <CircularBackButton onPress={onBack} variant="light" />
          <Text style={styles.title}>{title}</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" size="large" />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <CircularBackButton onPress={onBack} variant="light" />
          <Text style={styles.title}>{title}</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <Text style={styles.errorText}>{error || 'Không tìm thấy đơn.'}</Text>
      </View>
    );
  }

  if (kind === 'deal') {
    const { qty, originalTotal, offeredTotal, lastOfferBy } = resolveDealTotals(item);
    const offerLabel = getDealOfferLabel(item.status, lastOfferBy);
    const canReserve = item.status === DEAL_OFFER_STATUS.ACCEPTED && !item.reservationId;
    const canResubmit =
      item.status === DEAL_OFFER_STATUS.REJECTED ||
      (item.status === DEAL_OFFER_STATUS.ACCEPTED && !item.reservationId);
    const waitingForBuyer =
      item.status === DEAL_OFFER_STATUS.PENDING && lastOfferBy === DEAL_OFFER_BY.SELLER;
    const canAcceptCounter = waitingForBuyer;
    const canCounter = waitingForBuyer;

    async function handleAcceptCounter() {
      Alert.alert(
        'Chấp nhận giá shop',
        `Bạn đồng ý mua với tổng ${formatPrice(offeredTotal)} (${qty} sp)?`,
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Đồng ý',
            onPress: async () => {
              setIsActing(true);
              try {
                const idToken = await getCurrentUserIdToken();
                const updated = await acceptBuyerCounterOnBackend(idToken, item.id);
                setItem(updated);
                onChanged?.();
                onReserveFromDeal?.(updated || item);
              } catch (actionError) {
                Alert.alert('Lỗi', actionError.message || 'Không thể chấp nhận giá.');
              } finally {
                setIsActing(false);
              }
            },
          },
        ]
      );
    }

    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <CircularBackButton onPress={onBack} variant="light" />
          <Text style={styles.title}>{title}</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.card}>
            <Text style={styles.codeLabel}>Mã đơn hàng</Text>
            <Text style={styles.code}>{formatOrderCode(item.id || resolvedId)}</Text>

            <DetailRow label="Trạng thái" value={DEAL_STATUS_LABELS[item.status] || 'Không rõ'} />
            <DetailRow label="Sản phẩm" value={item.productName || '—'} />
            <DetailRow label="Phân loại" value={item.variantName || '—'} />
            <DetailRow label="Gian hàng" value={pickStoreName(item.storeName, item.shopUsername)} />
            <DetailRow label="Số lượng" value={String(qty)} />
            <DetailRow label="Giá niêm yết" value={formatPrice(originalTotal)} />
            <DetailRow label={offerLabel} value={formatPrice(offeredTotal)} emphasize />
            {String(
              Number(item.lastOfferBy) === DEAL_OFFER_BY.SELLER
                ? item.sellerNote || ''
                : item.note || ''
            ).trim() ? (
              <DetailRow
                label="Lời nhắn"
                value={String(
                  Number(item.lastOfferBy) === DEAL_OFFER_BY.SELLER
                    ? item.sellerNote || ''
                    : item.note || ''
                ).trim()}
              />
            ) : null}
            <DetailRow
              label="Giảm"
              value={`${Math.max(0, Math.round(((originalTotal - offeredTotal) / (originalTotal || 1)) * 100))}%`}
            />
            <DetailRow label="Thời gian" value={formatDateTime(item.createdAt)} />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actionCol}>
            {canAcceptCounter ? (
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                disabled={isActing}
                onPress={handleAcceptCounter}
              >
                <Text style={styles.actionBtnText}>Chấp nhận giá</Text>
              </Pressable>
            ) : null}
            {canCounter ? (
              <Pressable
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                disabled={isActing}
                onPress={() => onCounterDeal?.(item)}
              >
                <Text style={styles.actionBtnTextSecondary}>Đề nghị lại</Text>
              </Pressable>
            ) : null}
            {canReserve ? (
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                disabled={isActing}
                onPress={() => onReserveFromDeal?.(item)}
              >
                <Text style={styles.actionBtnText}>Giữ hàng</Text>
              </Pressable>
            ) : null}
            {canResubmit ? (
              <Pressable
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                disabled={isActing}
                onPress={() => onResubmitDeal?.(item)}
              >
                <Text style={styles.actionBtnTextSecondary}>Deal giá lại</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
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
        <Text style={styles.title}>{title}</Text>
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
    backgroundColor: '#0f766e',
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
    color: '#0f766e',
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
    backgroundColor: '#0f766e',
  },
  actionBtnSecondary: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#99f6e4',
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
    color: '#0f766e',
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

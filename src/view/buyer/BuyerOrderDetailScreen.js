import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SubScreenHeader from '../shared/components/SubScreenHeader';
import BuyerPickupQrDisplayScreen from './BuyerPickupQrDisplayScreen';
import { showErrorAlert } from '../../core/utils/appAlert';
import AvatarBadge from '../shared/components/AvatarBadge';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import ReservationDisputeSection from '../shared/components/ReservationDisputeSection';
import ReservationDisputeResultBlock from '../shared/components/ReservationDisputeResultBlock';
import ReservationAdjustmentSection from '../shared/components/ReservationAdjustmentSection';
import BuyerOrderReviewSection from '../shared/components/BuyerOrderReviewSection';
import {
  cancelBuyerReservationOnBackend,
  forfeitBuyerDepositOnBackend,
  getBuyerReservationOnBackend,
  getReservationDisputeReportsOnBackend,
  reportBuyerReservationOnBackend,
} from '../../api/buyerOpsApi';
import { deleteBuyerReviewOnBackend } from '../../api/reviewApi';
import {
  RESERVATION_STATUS,
  getCancelledReservationReason,
  getOrderDetailStatusLabel,
  getSellerCancelNote,
  hasAdminDisputeResolution,
  hasDisputeReportHistory,
  isActiveDisputeOrder,
  isDisputeHistoryReadOnlyOrder,
  isDisputeResolvedOrder,
  isCancelledReservationStatus,
  isDeliveredReservationStatus,
  isPostDeliveryComplaintContext,
  isSellerCancelAfterAcceptOrder,
  VIEWER_ROLE,
} from '../../constants/sellerOrders';
import {
  getOrderDetailDisplay,
  getCompletedTabDepositLine,
  isCompletedTabDepositPendingLine,
} from '../../core/utils/orderDisplay';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getOrderCodeValue } from '../../core/utils/orderCode';
import {
  getReservationProductId,
  getReservationShopId,
  reservationRequiresDeposit,
} from '../../core/utils/reservationEntity';
import { formatPrice } from '../../core/utils/productFormat';
import { getBuyerCancelConfirmMessage } from '../../core/utils/buyerCancelReservation';
import {
  getOrderCountdownLine,
  getDisputeActionButtonLabel,
  getPastPickupReportDetailLine,
  isDepositAlreadySettled,
  isWithinDepositDecisionWindowForItem,
  isPastPickupTime,
  getPrePickupDisputeWindowText,
} from '../../core/utils/escrowHold';
import {
  buildViewReviewPayload,
  canShowReviewButton,
  canShowComplaintButton,
  canViewExistingReview,
} from '../../core/utils/orderReview';
import { useOrderTimeNow } from '../../hooks/useOrderTimeNow';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { coalesceReservationFetch } from '../../core/utils/coalesceReservationFetch';
import { useOrderSocket } from '../../hooks/useOrderSocket';

function formatPickupSchedule(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return {
    time: `${hours}:${minutes}`,
    date: `${day}/${month}/${year}`,
  };
}

function PaymentRow({ label, value, valueStyle }) {
  return (
    <View style={styles.paymentRow}>
      <Text style={styles.paymentLabel}>{label}</Text>
      <Text style={[styles.paymentValue, valueStyle]}>{value}</Text>
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
  const merged = {
    ...prev,
    ...next,
    id: next.id || prev.id,
    shopId: next.shopId || prev.shopId || '',
    storeName: pickStoreName(next.storeName, prev.storeName, next.shopUsername, prev.shopUsername),
    shopUsername: next.shopUsername || prev.shopUsername || '',
    productName: next.productName || prev.productName || next.product?.productName || '',
    shop: next.shop
      ? { ...(prev.shop || {}), ...next.shop }
      : prev.shop || null,
    product: next.product || prev.product || null,
    variant: next.variant || prev.variant || null,
  };

  const prevReason = getCancelledReservationReason(prev, VIEWER_ROLE.BUYER);
  const nextReason = getCancelledReservationReason(merged, VIEWER_ROLE.BUYER);
  if (prevReason && !nextReason) {
    merged.cancelNote = prev.cancelNote || merged.cancelNote;
    merged.reasonCode = prev.reasonCode || merged.reasonCode;
    merged.reasonLabelBuyer = prev.reasonLabelBuyer || merged.reasonLabelBuyer;
    merged.reasonLabelSeller = prev.reasonLabelSeller || merged.reasonLabelSeller;
    merged.cancelType = prev.cancelType || merged.cancelType;
    merged.cancelledBy = prev.cancelledBy || merged.cancelledBy;
    merged.cancelReason = prev.cancelReason || merged.cancelReason;
    merged.cancelledAt = prev.cancelledAt || merged.cancelledAt;
    merged.cocChuyenDen =
      prev.cocChuyenDen != null ? prev.cocChuyenDen : merged.cocChuyenDen;
    merged.cancelNote = prev.cancelNote || merged.cancelNote;
    merged.anhHuyShop =
      Array.isArray(prev.anhHuyShop) && prev.anhHuyShop.length
        ? prev.anhHuyShop
        : merged.anhHuyShop;
    merged.cancelledBySellerAfterAccept =
      prev.cancelledBySellerAfterAccept ?? merged.cancelledBySellerAfterAccept;
  }

  return merged;
}

export default function BuyerOrderDetailScreen({
  orderId,
  initialItem = null,
  listCancelReasonText = '',
  onBack,
  onChanged,
  onNavigatePickup,
  onOpenShopScan,
  onOpenShop,
  onOpenProduct,
  onReviewStore,
  onReviewDeleted,
  reviewsByOrderId = null,
  reviewedOrderCodes = null,
}) {
  const resolvedId = String(orderId || initialItem?.id || '').trim();
  const [item, setItem] = useState(initialItem);
  const [isLoading, setIsLoading] = useState(!initialItem);
  const [isActing, setIsActing] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showPickupQr, setShowPickupQr] = useState(false);
  const [disputeReports, setDisputeReports] = useState([]);
  const insets = useScreenInsets();
  const pickupScheduleItems = useMemo(() => {
    if (item?.status !== RESERVATION_STATUS.WAITING_PICKUP || !item?.pickupTime) {
      return [];
    }
    return [item];
  }, [item?.id, item?.status, item?.pickupTime]);

  const loadDisputeReports = useCallback(async (reservationId) => {
    try {
      const idToken = await getCurrentUserIdToken();
      const reports = await getReservationDisputeReportsOnBackend(idToken, reservationId);
      setDisputeReports(Array.isArray(reports) ? reports : []);
    } catch {
      setDisputeReports([]);
    }
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!resolvedId) {
        showErrorAlert('Thiếu mã đơn hàng.');
        setIsLoading(false);
        return;
      }
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const idToken = await getCurrentUserIdToken();
        const reservation = await getBuyerReservationOnBackend(idToken, resolvedId);
        setItem((prev) => mergeLoadedItem(prev, reservation));
        await loadDisputeReports(resolvedId);
      } catch (loadError) {
        if (!silent) {
          showErrorAlert(loadError.message || 'Không tải được chi tiết đơn.');
        }
        setItem((prev) => prev || initialItem);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [resolvedId, initialItem, loadDisputeReports]
  );

  const handlePickupBoundary = useCallback(() => {
    load({ silent: true });
  }, [load]);

  const currentTime = useOrderTimeNow({
    enabled: true,
    items: pickupScheduleItems,
    onPickupBoundary: handlePickupBoundary,
  });

  useEffect(() => {
    load();
  }, [load]);

  const handleOrderUpdated = useCallback(
    (payload) => {
      if (!payload?.reservationId || String(payload.reservationId) !== String(resolvedId)) {
        return;
      }
      coalesceReservationFetch('buyer', resolvedId, () => load({ silent: true })).catch(() => {});
    },
    [load, resolvedId]
  );

  useOrderSocket({
    enabled: Boolean(resolvedId),
    onOrderUpdated: handleOrderUpdated,
  });

  if (isLoading && !item) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Chi tiết đơn hàng" onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Chi tiết đơn hàng" onBack={onBack} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Không tìm thấy đơn hàng.</Text>
        </View>
      </View>
    );
  }

  if (showPickupQr) {
    return (
      <BuyerPickupQrDisplayScreen
        reservation={item}
        onBack={() => setShowPickupQr(false)}
        onReservationUpdated={(updated) => setItem((prev) => mergeLoadedItem(prev, updated))}
      />
    );
  }

  const reservation = item;
  const pastPickup = isPastPickupTime(reservation, currentTime);
  const withinDecision = isWithinDepositDecisionWindowForItem(reservation, currentTime);
  const isCompletedOrderView =
    isDeliveredReservationStatus(reservation.status) ||
    reservation.status === RESERVATION_STATUS.COMPLETED ||
    reservation.status === RESERVATION_STATUS.AUTO_COMPLETED;
  const headerCountdownLine =
    isCompletedOrderView || isDisputeResolvedOrder(reservation)
      ? ''
      : getPastPickupReportDetailLine(reservation, VIEWER_ROLE.BUYER, currentTime) ||
        getOrderCountdownLine(reservation, currentTime, VIEWER_ROLE.BUYER);
  const canCancel =
    reservation.canCancel === true ||
    reservation.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;
  const canShowPickupQr =
    !pastPickup &&
    (reservation.canShowPickupQr === true ||
      reservation.status === RESERVATION_STATUS.WAITING_PICKUP);
  const isDisputeHistoryReadOnly = isDisputeHistoryReadOnlyOrder(reservation);
  const canReportShopRaw =
    !isDisputeHistoryReadOnly &&
    !reservation.disputeByBuyer &&
    (reservation.canComplaint === true ||
      reservation.canReportShop === true ||
      (isDeliveredReservationStatus(reservation.status) &&
        withinDecision &&
        !reservation.disputeByBuyer) ||
      (((reservation.status === RESERVATION_STATUS.WAITING_PICKUP &&
        pastPickup &&
        withinDecision) ||
        reservation.status === RESERVATION_STATUS.DISPUTED) &&
        !reservation.disputeByBuyer));
  const canReportShop =
    canReportShopRaw && canShowComplaintButton(reservation, reviewsByOrderId);
  const canForfeitDeposit =
    !isDisputeHistoryReadOnly &&
    !reservation.disputeByBuyer &&
    !isDepositAlreadySettled(reservation) &&
    (reservation.canForfeitDeposit === true ||
      (reservation.canForfeitDeposit !== false &&
        (reservation.status === RESERVATION_STATUS.WAITING_PICKUP ||
          reservation.status === RESERVATION_STATUS.DISPUTED) &&
        pastPickup &&
        withinDecision));
  const sellerReport = disputeReports.find((report) => report.reporterSide === 'seller');
  const buyerReport = disputeReports.find((report) => report.reporterSide === 'buyer');
  const canNavigate =
    reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup;
  const storeName = pickStoreName(
    reservation.storeName,
    reservation.shop?.shopName,
    reservation.shopUsername
  );
  const shopId = getReservationShopId(reservation);
  const productId = getReservationProductId(reservation);

  function handleOpenShop() {
    if (!shopId) {
      Alert.alert('Thông báo', 'Không xác định được gian hàng.');
      return;
    }
    onOpenShop?.({ shopId, storeName });
  }

  function handleOpenProduct() {
    if (!productId) {
      Alert.alert('Thông báo', 'Không xác định được sản phẩm.');
      return;
    }
    onOpenProduct?.({ productId, shopId, storeName });
  }
  const statusLabel = getOrderDetailStatusLabel(reservation);
  const orderDisplay = getOrderDetailDisplay(reservation, VIEWER_ROLE.BUYER, currentTime);
  const cancelReasonText =
    String(listCancelReasonText || '').trim() || orderDisplay.cancelReasonLine;
  const cancelDepositLine = orderDisplay.depositLine;
  const sellerCancelNote = getSellerCancelNote(reservation);
  const anhHuyShop = Array.isArray(reservation.anhHuyShop)
    ? reservation.anhHuyShop.filter(Boolean)
    : [];
  const showSellerCancelEvidence =
    isSellerCancelAfterAcceptOrder(reservation) &&
    !(hasDisputeReportHistory(reservation) && !isActiveDisputeOrder(reservation));
  const showAdminResolutionSection = hasAdminDisputeResolution(reservation, disputeReports);
  const showCancelReasonSection =
    !isActiveDisputeOrder(reservation) &&
    !isDisputeResolvedOrder(reservation) &&
    !showAdminResolutionSection &&
    (Boolean(cancelReasonText) ||
      (showSellerCancelEvidence && Boolean(sellerCancelNote)) ||
      (showSellerCancelEvidence && anhHuyShop.length > 0));
  const hasDeposit = reservationRequiresDeposit(reservation);
  const isCompletedOrder = isDeliveredReservationStatus(reservation.status);
  const detailDepositLine = (() => {
    if (!hasDeposit || showAdminResolutionSection || isActiveDisputeOrder(reservation)) {
      return '';
    }
    if (isCompletedOrder) {
      return getCompletedTabDepositLine(reservation, VIEWER_ROLE.BUYER, currentTime);
    }
    if (isDisputeResolvedOrder(reservation) || isCancelledReservationStatus(reservation.status)) {
      return cancelDepositLine;
    }
    return cancelDepositLine;
  })();
  const showDepositSection = Boolean(detailDepositLine);
  const detailDepositPending = isCompletedTabDepositPendingLine(detailDepositLine);
  const statusChipStyle =
    isDisputeResolvedOrder(reservation)
      ? styles.statusChip
      : isCancelledReservationStatus(reservation.status) ||
          reservation.status === RESERVATION_STATUS.DISPUTED
        ? styles.statusChipCancelled
        : reservation.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION ||
            reservation.status === RESERVATION_STATUS.WAITING_PICKUP
          ? styles.statusChipPending
          : styles.statusChip;
  const pickupDisplay = formatPickupSchedule(reservation.pickupTime);
  const orderPlacedDisplay = formatPickupSchedule(reservation.createdAt);
  const totalAmount = Number(reservation.totalAmount) || 0;
  const depositAmount = Number(reservation.depositAmount) || 0;
  const depositPercent = Math.max(0, Math.min(100, Number(reservation.depositPercent) || 0));
  const cashDue = Math.max(0, totalAmount - depositAmount);
  const qty = Number(reservation.quantity) || 0;
  const unitPrice =
    reservation.agreedPrice != null
      ? Number(reservation.agreedPrice)
      : reservation.variant?.price != null
        ? Number(reservation.variant.price)
        : qty > 0
          ? Math.round(totalAmount / qty)
          : 0;

  const showHoldingPrimaryActions =
    reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup;
  const isPickupDispute =
    isActiveDisputeOrder(reservation) && !isPostDeliveryComplaintContext(reservation);
  const showDisputeActions =
    !isDisputeHistoryReadOnly &&
    isPickupDispute &&
    (canReportShop || canForfeitDeposit);
  const disputeReportLabel = isPickupDispute
    ? getDisputeActionButtonLabel(reservation, VIEWER_ROLE.BUYER, currentTime)
    : 'Khiếu nại';
  const disputeForfeitLabel = isPickupDispute ? 'Hoàn cọc' : 'Đồng ý mất cọc';
  const canReview =
    reservation.canReview !== false &&
    isCompletedOrder &&
    canShowReviewButton(reservation, reviewedOrderCodes);
  const canViewReview = canViewExistingReview(reservation, reviewsByOrderId);
  const existingReview = canViewReview
    ? buildViewReviewPayload(reservation, reviewsByOrderId, {
        storeName: reservation.storeName,
        productName: reservation.product?.productName,
      })
    : null;

  async function handleCancel() {
    Alert.alert('Hủy đơn hàng?', getBuyerCancelConfirmMessage(reservation), [
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

  function handleShowPickupQr() {
    setShowPickupQr(true);
  }

  function handleReportShop() {
    setShowDisputeModal(true);
  }

  async function handleSubmitDispute(payload) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const updated = await reportBuyerReservationOnBackend(idToken, {
        reservationId: reservation.id,
        reason: payload.reason,
        description: payload.description,
        images: payload.images,
      });
      setItem((prev) => mergeLoadedItem(prev, updated));
      setShowDisputeModal(false);
      await loadDisputeReports(reservation.id);
      onChanged?.();
      Alert.alert(
        'Đã gửi',
        isDeliveredReservationStatus(updated?.status ?? reservation.status)
          ? 'Khiếu nại đã gửi tới shop. Shop có 2 ngày phản hồi, sau đó admin sẽ xử lý.'
          : 'Khiếu nại đã gửi. Admin sẽ xử lý, cọc tạm giữ.'
      );
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được khiếu nại.');
      throw actionError;
    } finally {
      setIsActing(false);
    }
  }

  function handleForfeitDeposit() {
    Alert.alert(
      'Đồng ý mất cọc',
      'Bạn xác nhận không khiếu nại và đồng ý chuyển tiền cọc cho người bán?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý mất cọc',
          style: 'destructive',
          onPress: async () => {
            setIsActing(true);
            try {
              const idToken = await getCurrentUserIdToken();
              const updated = await forfeitBuyerDepositOnBackend(idToken, reservation.id);
              setItem((prev) => mergeLoadedItem(prev, updated));
              onChanged?.();
              Alert.alert('Xong', 'Cọc đã chuyển cho người bán.');
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không xử lý được mất cọc.');
            } finally {
              setIsActing(false);
            }
          },
        },
      ]
    );
  }

  function handleCallShop() {
    const phone = reservation.shop?.phone;
    if (!phone) {
      Alert.alert('Thông báo', 'Cửa hàng chưa có số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  }

  function handleHoldingMoreMenu() {
    handleCancel();
  }

  async function handleDeleteReview(review) {
    const reviewId = String(review?.id || reservation.buyerReviewId || '').trim();
    if (!reviewId) {
      Alert.alert('Lỗi', 'Không xác định được đánh giá.');
      return;
    }

    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      await deleteBuyerReviewOnBackend(idToken, reviewId);
      const updated = await getBuyerReservationOnBackend(idToken, resolvedId);
      setItem((prev) => mergeLoadedItem(prev, updated));
      onReviewDeleted?.(reservation);
      onChanged?.();
      Alert.alert('Đã gỡ', 'Đánh giá đã được gỡ bỏ. Bạn không thể đánh giá lại đơn này.');
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gỡ được đánh giá.');
    } finally {
      setIsActing(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Chi tiết đơn hàng" onBack={onBack} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: Math.max(insets.nestedScrollPaddingBottom, 28) },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.orderMetaRow}>
            <Text style={styles.orderCode} numberOfLines={1}>
              Đơn hàng: {getOrderCodeValue(reservation.id || resolvedId)}
            </Text>
            <View style={styles.orderMetaTrailing}>
              <Text style={statusChipStyle} numberOfLines={2}>
                {statusLabel}
              </Text>
              {showHoldingPrimaryActions ? (
                <Pressable
                  style={styles.itemMoreBtn}
                  disabled={isActing}
                  onPress={handleHoldingMoreMenu}
                  accessibilityRole="button"
                  accessibilityLabel="Hủy đơn hàng"
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {headerCountdownLine ? (
            <Text style={styles.disputeDeadlineLine}>{headerCountdownLine}</Text>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THÔNG TIN CỬA HÀNG</Text>
          <View style={styles.shopRow}>
            <Pressable
              style={({ pressed }) => [styles.shopTapArea, pressed && styles.tapAreaPressed]}
              onPress={handleOpenShop}
              accessibilityRole="button"
              accessibilityLabel={`Xem gian hàng ${storeName}`}
            >
              <AvatarBadge name={storeName} uri={reservation.shop?.avatar || ''} size={52} />
              <View style={styles.shopInfo}>
                <Text style={styles.shopName} numberOfLines={1}>
                  {storeName}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
            <Pressable
              onPress={handleCallShop}
              style={({ pressed }) => [styles.callIconBtn, pressed && styles.callIconBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Gọi cửa hàng"
              hitSlop={8}
            >
              <Ionicons name="call" size={20} color="#076F32" />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THÔNG TIN SẢN PHẨM</Text>
          <Pressable
            style={({ pressed }) => [styles.productRow, pressed && styles.tapAreaPressed]}
            onPress={handleOpenProduct}
            accessibilityRole="button"
            accessibilityLabel={`Xem sản phẩm ${reservation.product?.productName || ''}`}
          >
            <View style={styles.productThumbWrap}>
              {reservation.product?.thumbnail ? (
                <Image
                  source={{ uri: reservation.product.thumbnail }}
                  style={styles.productThumb}
                />
              ) : (
                <Text style={styles.productThumbEmoji}>📦</Text>
              )}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {reservation.product?.productName || 'Sản phẩm'}
              </Text>
              {reservation.variant?.variantName ? (
                <Text style={styles.productMeta}>
                  Loại: {reservation.variant.variantName}
                </Text>
              ) : null}
              <View style={styles.productPriceRow}>
                <Text style={styles.productMeta}>Giá: {formatPrice(unitPrice)}</Text>
                <Text style={styles.productQtyMark}>x{qty || 1}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>CHI TIẾT THANH TOÁN</Text>
          <PaymentRow label="Tổng tiền hàng:" value={formatPrice(totalAmount)} />
          <PaymentRow
            label={`Đặt cọc ${depositPercent}%:`}
            value={formatPrice(depositAmount)}
          />
          <PaymentRow
            label="Thanh toán khi nhận hàng:"
            value={formatPrice(cashDue)}
            valueStyle={styles.paymentValueDanger}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THỜI GIAN ĐẶT HÀNG</Text>
          <View style={styles.pickupTimeRow}>
            <Ionicons name="time-outline" size={18} color="#64748b" />
            {orderPlacedDisplay ? (
              <Text style={styles.pickupTimeText}>
                Giờ: <Text style={styles.pickupTimeValue}>{orderPlacedDisplay.time}</Text>
                {' · '}
                Ngày: <Text style={styles.pickupTimeValue}>{orderPlacedDisplay.date}</Text>
              </Text>
            ) : (
              <Text style={styles.pickupTimeText}>Giờ: — · Ngày: —</Text>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeading}>THỜI GIAN NHẬN HÀNG</Text>
          <View style={styles.pickupTimeRow}>
            <Ionicons name="time-outline" size={18} color="#64748b" />
            {pickupDisplay ? (
              <Text style={styles.pickupTimeText}>
                Giờ: <Text style={styles.pickupTimeValue}>{pickupDisplay.time}</Text>
                {' · '}
                Ngày: <Text style={styles.pickupTimeValue}>{pickupDisplay.date}</Text>
              </Text>
            ) : (
              <Text style={styles.pickupTimeText}>Giờ: — · Ngày: —</Text>
            )}
          </View>

          {reservation.note ? (
            <Text style={styles.noteLine}>Ghi chú: {reservation.note}</Text>
          ) : null}

          {reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup ? (
            <>
              <View style={styles.divider} />
              <View style={styles.pickupNoticeBlock}>
                <Text style={styles.pickupNoticeTitle}>ĐẾN LẤY HÀNG</Text>
                <Text style={styles.pickupNoticeBody}>
                  Đến shop đúng giờ, rồi quét QR cố định của cửa hàng để xác nhận đã nhận hàng và
                  chuyển cọc.
                </Text>
              </View>
            </>
          ) : null}

          {reservation.status === RESERVATION_STATUS.WAITING_PICKUP && pastPickup ? (
            <>
              <View style={styles.divider} />
              <View style={styles.pickupNoticeBlock}>
                <Text style={styles.pickupOverdueTitle}>ĐÃ QUÁ GIỜ NHẬN HÀNG</Text>
                <Text style={styles.pickupNoticeBody}>
                  {withinDecision
                    ? `Trong ${getPrePickupDisputeWindowText()} người mua có thể khiếu nại và chờ admin xử lý hoặc đồng ý mất cọc (chuyển cọc cho người bán).`
                    : `Đã quá ${getPrePickupDisputeWindowText()} sau giờ nhận. Cọc mặc định đã chuyển cho người bán.`}
                </Text>
              </View>
            </>
          ) : null}

          <ReservationAdjustmentSection reservation={reservation} />

          <ReservationDisputeSection
            reservation={reservation}
            buyerReport={buyerReport}
            sellerReport={sellerReport}
            viewerRole={VIEWER_ROLE.BUYER}
          />

          <ReservationDisputeResultBlock
            reservation={reservation}
            reports={disputeReports}
            viewerRole={VIEWER_ROLE.BUYER}
          />

          {showCancelReasonSection ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.cancelReasonHeading}>LÝ DO</Text>
              {cancelReasonText ? (
                <Text style={styles.cancelReasonBody}>{cancelReasonText}</Text>
              ) : null}
              {!showSellerCancelEvidence || !sellerCancelNote ? null : (
                <View style={styles.cancelDetailBlock}>
                  <Text style={styles.cancelDetailBody}>{sellerCancelNote}</Text>
                </View>
              )}
              {!showSellerCancelEvidence || !anhHuyShop.length ? null : (
                <View style={styles.cancelEvidenceBlock}>
                  <Text style={styles.cancelDetailLabel}>Ảnh minh chứng</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {anhHuyShop.map((uri) => (
                      <Image key={uri} source={{ uri }} style={styles.evidencePhoto} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          ) : null}

          {showDepositSection ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.depositSectionHeading}>TIỀN CỌC</Text>
              <Text
                style={
                  detailDepositPending ? styles.depositPendingBody : styles.cancelDepositBody
                }
              >
                {detailDepositLine}
              </Text>
            </>
          ) : null}

          {canViewReview && existingReview ? (
            <BuyerOrderReviewSection
              review={existingReview}
              onDelete={handleDeleteReview}
              disabled={isActing}
            />
          ) : null}
        </View>

        <View style={styles.actionCol}>
          {isCompletedOrder && (canReportShop || canReview) ? (
            <View style={styles.holdingActionRow}>
              {canReportShop ? (
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.actionBtnDanger,
                    canReview ? styles.actionBtnHalf : null,
                  ]}
                  disabled={isActing}
                  onPress={handleReportShop}
                >
                  <Text style={styles.actionBtnTextDanger}>Khiếu nại</Text>
                </Pressable>
              ) : null}
              {canReview ? (
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.actionBtnPrimary,
                    styles.actionBtnReview,
                    canReportShop ? styles.actionBtnHalf : null,
                  ]}
                  disabled={isActing}
                  onPress={() =>
                    onReviewStore?.({
                      shopId: reservation.shopId ? String(reservation.shopId) : '',
                      storeId: reservation.shopId ? String(reservation.shopId) : '',
                      storeName: reservation.storeName,
                      productId: reservation.product?.id
                        ? String(reservation.product.id)
                        : '',
                      productName: reservation.product?.productName,
                      reservationId: reservation.id ? String(reservation.id) : '',
                      orderCode: reservation.id ? String(reservation.id) : '',
                    })
                  }
                >
                  <Text style={[styles.actionBtnText, styles.actionBtnReviewText]}>Đánh giá</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {showHoldingPrimaryActions ? (
            <View style={styles.holdingActionRow}>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnHalf]}
                disabled={isActing}
                onPress={() =>
                  onNavigatePickup?.({
                    shopId: reservation.shopId,
                    reservationId: String(reservation.id),
                    storeName: reservation.storeName,
                  })
                }
              >
                <Text style={styles.actionBtnText}>Đến lấy hàng</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnHalf]}
                disabled={isActing}
                onPress={handleShowPickupQr}
              >
                <Text style={styles.actionBtnText}>Mã QR nhận hàng</Text>
              </Pressable>
            </View>
          ) : null}
          {!showHoldingPrimaryActions && canNavigate ? (
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
          {!showHoldingPrimaryActions && canShowPickupQr ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              disabled={isActing}
              onPress={handleShowPickupQr}
            >
              <Text style={styles.actionBtnText}>Mã QR nhận hàng</Text>
            </Pressable>
          ) : null}
          {!showHoldingPrimaryActions &&
          !showDisputeActions &&
          (canForfeitDeposit || (canReportShop && !isCompletedOrder)) ? (
            <View style={styles.holdingActionRow}>
              {canReportShop ? (
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.actionBtnDanger,
                    canForfeitDeposit ? styles.actionBtnHalf : null,
                  ]}
                  disabled={isActing}
                  onPress={handleReportShop}
                >
                  <Text style={styles.actionBtnTextDanger}>{disputeReportLabel}</Text>
                </Pressable>
              ) : null}
              {canForfeitDeposit ? (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnHalf]}
                  disabled={isActing}
                  onPress={handleForfeitDeposit}
                >
                  <Text style={styles.actionBtnText}>{disputeForfeitLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {showDisputeActions ? (
            <View style={styles.holdingActionRow}>
              {canReportShop ? (
                <Pressable
                  style={[
                    styles.actionBtn,
                    styles.reportBtn,
                    canForfeitDeposit ? styles.actionBtnHalf : null,
                  ]}
                  disabled={isActing}
                  onPress={handleReportShop}
                >
                  <Text style={styles.reportBtnText}>{disputeReportLabel}</Text>
                </Pressable>
              ) : null}
              {canForfeitDeposit ? (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnPrimary, styles.actionBtnHalf]}
                  disabled={isActing}
                  onPress={handleForfeitDeposit}
                >
                  <Text style={styles.actionBtnText}>{disputeForfeitLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {!showHoldingPrimaryActions && canCancel ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              disabled={isActing}
              onPress={handleCancel}
            >
              <Text style={styles.actionBtnTextDanger}>Hủy đơn</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <ReservationDisputeModal
        visible={showDisputeModal}
        mode="buyer"
        buyerComplaintKind={
          isPostDeliveryComplaintContext(reservation) ? 'post_delivery' : 'pickup'
        }
        onClose={() => setShowDisputeModal(false)}
        onSubmit={handleSubmitDispute}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderMetaTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  itemMoreBtn: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  orderCode: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  disputeDeadlineLine: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#ea580c',
    lineHeight: 20,
  },
  statusChip: {
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#076F32',
  },
  statusChipPending: {
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  statusChipCancelled: {
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shopTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  tapAreaPressed: {
    opacity: 0.82,
  },
  linkHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#076F32',
  },
  shopInfo: {
    flex: 1,
    minWidth: 0,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  callIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconBtnPressed: {
    opacity: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  productRow: { flexDirection: 'row', gap: 12 },
  productThumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productThumb: { width: '100%', height: '100%' },
  productThumbEmoji: { fontSize: 28 },
  productInfo: { flex: 1, gap: 4, paddingTop: 2 },
  productName: { fontSize: 15, fontWeight: '800', color: '#0f172a', lineHeight: 20 },
  productMeta: { fontSize: 14, color: '#334155', fontWeight: '600' },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  productQtyMark: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  paymentValueDanger: {
    color: '#dc2626',
  },
  pickupTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickupTimeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 20,
  },
  pickupTimeValue: {
    fontWeight: '800',
    color: '#0f172a',
  },
  noteLine: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  noteLineDanger: {
    marginTop: 4,
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '700',
    lineHeight: 22,
  },
  cancelReasonHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  cancelReasonBody: {
    fontSize: 13,
    color: '#b91c1c',
    lineHeight: 20,
    fontWeight: '600',
  },
  cancelDepositBody: {
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 20,
    fontWeight: '600',
  },
  depositPendingBody: {
    fontSize: 13,
    color: '#ea580c',
    lineHeight: 20,
    fontWeight: '700',
  },
  depositSectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  cancelDetailBlock: {
    marginTop: 10,
    gap: 4,
  },
  cancelDetailLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
  },
  cancelDetailBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    fontWeight: '600',
  },
  pickupNoticeBlock: {
    gap: 8,
  },
  pickupNoticeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  pickupOverdueTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 0.2,
  },
  pickupNoticeBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '600',
  },
  evidenceCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
    gap: 6,
  },
  evidenceCardSelf: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 12,
    gap: 6,
  },
  evidenceTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  evidenceBody: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 18,
  },
  evidenceMeta: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  evidencePhotos: {
    marginTop: 4,
  },
  evidencePhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  cancelEvidenceBlock: {
    marginTop: 10,
    gap: 6,
  },
  actionCol: {
    marginTop: 16,
    gap: 10,
  },
  holdingActionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  actionBtnHalf: {
    flex: 1,
  },
  actionBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionBtnReview: {
    minHeight: 54,
    paddingVertical: 6,
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
    backgroundColor: '#DC2626',
    borderWidth: 0,
  },
  reportBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  reportBtnText: {
    color: '#c2410c',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnDisputeSolid: {
    backgroundColor: '#DC2626',
    borderWidth: 0,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnReviewText: {
    fontSize: 16,
  },
  actionBtnTextSecondary: {
    color: '#076F32',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnTextDanger: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnStacked: {
    paddingVertical: 10,
    gap: 4,
  },
  actionBtnSubtitleDanger: {
    color: '#076F32',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionBtnSubtitleLight: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    padding: 24,
    textAlign: 'center',
    color: '#64748b',
    fontWeight: '600',
  },
});

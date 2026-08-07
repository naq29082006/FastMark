import { useCallback, useEffect, useState } from 'react';
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
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { Ionicons } from '@expo/vector-icons';
import {
  confirmSellerReservationOnBackend,
  cancelSellerReservationOnBackend,
  getReservationDisputeReportsOnBackend,
  getSellerReservationDetailOnBackend,
  refundSellerDisputeDepositOnBackend,
  rejectSellerReservationOnBackend,
  reportBuyerNoShowOnBackend,
  respondSellerPostDeliveryComplaintOnBackend,
} from '../../api/sellerOpsApi';
import { showErrorAlert } from '../../core/utils/appAlert';
import {
  RESERVATION_STATUS,
  getCancelledReservationReason,
  getSellerCancelNote,
  getSellerCompletedOrderStatusLabel,
  hasAdminDisputeResolution,
  hasDisputeReportHistory,
  isActiveDisputeOrder,
  isCancelledReservationStatus,
  isSellerCancelAfterAcceptOrder,
  VIEWER_ROLE,
} from '../../constants/sellerOrders';
import { formatPrice } from '../../core/utils/productFormat';
import { getOrderCodeValue } from '../../core/utils/orderCode';
import {
  getSellerDepositReleaseCountdownLabel,
  getSellerResponseCountdownLabel,
} from '../../core/utils/escrowHold';
import { useMinuteNow } from '../../hooks/useMinuteNow';
import {
  getReservationBuyerId,
  getReservationProductId,
} from '../../core/utils/reservationEntity';
import AvatarBadge from '../shared/components/AvatarBadge';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import ReservationDisputeSection from '../shared/components/ReservationDisputeSection';
import ReservationAdjustmentSection from '../shared/components/ReservationAdjustmentSection';
import ReservationAdminResolutionSection from '../shared/components/ReservationAdminResolutionSection';
import SellerCancelAcceptedModal from '../shared/components/SellerCancelAcceptedModal';
import SellerOrderReviewSection from '../shared/components/SellerOrderReviewSection';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { useScreenInsets } from '../../hooks/useScreenInsets';
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

function isPastPickup(item, now) {
  if (!item?.pickupTime) return false;
  const pickup = new Date(item.pickupTime);
  return Number.isFinite(pickup.getTime()) && now >= pickup.getTime();
}

function isWithinDepositDecisionWindow(item, now = Date.now()) {
  if (item?.withinDepositDecisionWindow === true) return true;
  if (item?.withinDepositDecisionWindow === false) return false;
  const deadlineRaw = item?.depositDecisionDeadline || item?.autoReleaseAt || item?.reviewDeadlineAt;
  if (deadlineRaw) {
    const deadline = new Date(deadlineRaw);
    return Number.isFinite(deadline.getTime()) && now < deadline.getTime();
  }
  if (!item?.pickupTime) return false;
  const pickup = new Date(item.pickupTime);
  if (!Number.isFinite(pickup.getTime())) return false;
  return now < pickup.getTime() + 24 * 60 * 60 * 1000;
}

function OrderDetailLayout({ onBack, children }) {
  const insets = useScreenInsets();

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Chi tiết đơn hàng" onBack={onBack} />
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: insets.nestedScrollPaddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
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
    product: next.product || prev.product || null,
    variant: next.variant || prev.variant || null,
    buyer: next.buyer ? { ...(prev.buyer || {}), ...next.buyer } : prev.buyer || null,
  };

  const prevReason = getCancelledReservationReason(prev, VIEWER_ROLE.SELLER);
  const nextReason = getCancelledReservationReason(merged, VIEWER_ROLE.SELLER);
  if (prevReason && !nextReason) {
    merged.cancelReason = prev.cancelReason || merged.cancelReason;
    merged.reasonCode = prev.reasonCode || merged.reasonCode;
    merged.reasonLabelBuyer = prev.reasonLabelBuyer || merged.reasonLabelBuyer;
    merged.reasonLabelSeller = prev.reasonLabelSeller || merged.reasonLabelSeller;
    merged.cancelledBy = prev.cancelledBy || merged.cancelledBy;
    merged.cancelledAt = prev.cancelledAt || merged.cancelledAt;
    merged.depositSettleTo =
      prev.depositSettleTo != null ? prev.depositSettleTo : merged.depositSettleTo;
    merged.cancelNote = prev.cancelNote || merged.cancelNote;
    merged.sellerCancelImages =
      Array.isArray(prev.sellerCancelImages) && prev.sellerCancelImages.length
        ? prev.sellerCancelImages
        : merged.sellerCancelImages;
    merged.cancelledBySellerAfterAccept =
      prev.cancelledBySellerAfterAccept ?? merged.cancelledBySellerAfterAccept;
  }

  return merged;
}

export default function SellerOrderDetailScreen({
  reservationId,
  initialItem = null,
  listCancelReasonText = '',
  onBack,
  onChanged,
  onOpenBuyer,
  onOpenProduct,
}) {
  const resolvedId = String(reservationId || initialItem?.id || '').trim();
  const [reservation, setReservation] = useState(initialItem);
  const [isLoading, setIsLoading] = useState(!initialItem);
  const [isActing, setIsActing] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showCancelAcceptedModal, setShowCancelAcceptedModal] = useState(false);
  const [disputeReports, setDisputeReports] = useState([]);
  const currentTime = useMinuteNow(true);

  const loadDisputeReports = useCallback(async () => {
    if (!resolvedId) {
      setDisputeReports([]);
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      const reports = await getReservationDisputeReportsOnBackend(idToken, resolvedId);
      setDisputeReports(Array.isArray(reports) ? reports : []);
    } catch {
      setDisputeReports([]);
    }
  }, [resolvedId]);

  const loadDetail = useCallback(
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
        const data = await getSellerReservationDetailOnBackend(idToken, resolvedId);
        setReservation((prev) => mergeLoadedItem(prev, data));
        await loadDisputeReports();
      } catch (loadError) {
        if (!silent) {
          showErrorAlert(loadError.message || 'Không tải được chi tiết đơn.');
        }
        setReservation((prev) => prev || initialItem);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [resolvedId, initialItem, loadDisputeReports]
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleOrderUpdated = useCallback(
    (payload) => {
      if (!payload?.reservationId || String(payload.reservationId) !== String(resolvedId)) {
        return;
      }
      // Cập nhật im lặng: không bật spinner khi đang xem chi tiết.
      loadDetail({ silent: true });
    },
    [loadDetail, resolvedId]
  );

  useOrderSocket({
    enabled: Boolean(resolvedId),
    onOrderUpdated: handleOrderUpdated,
  });

  async function runAction(action) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      let updated;
      if (action === 'confirm') {
        updated = await confirmSellerReservationOnBackend(idToken, reservationId);
      } else if (action === 'reject') {
        updated = await rejectSellerReservationOnBackend({
          idToken,
          reservationId,
          reason: 'Shop hủy',
        });
      }
      setReservation(updated);
      onChanged?.();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không thực hiện được thao tác.');
    } finally {
      setIsActing(false);
    }
  }

  function handleConfirm() {
    const depositNote =
      Number(reservation?.depositAmount) > 0
        ? `\n\nSau khi đồng ý, đưa QR gian hàng cho khách quét khi nhận hàng. Khi đó bạn nhận cọc ${formatPrice(reservation.depositAmount)}.`
        : '\n\nSau khi đồng ý, đưa QR gian hàng cho khách quét khi nhận hàng để hoàn tất đơn.';
    Alert.alert('Đồng ý giữ hàng', `Bạn xác nhận giữ hàng cho khách này?${depositNote}`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đồng ý', onPress: () => runAction('confirm') },
    ]);
  }

  function handleReject() {
    Alert.alert('Từ chối giữ hàng', 'Bạn chắc chắn từ chối yêu cầu giữ hàng này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: () => runAction('reject'),
      },
    ]);
  }

  function handleOpenCancelAccepted() {
    setShowCancelAcceptedModal(true);
  }

  async function handleSubmitCancelAccepted(payload) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const updated = await cancelSellerReservationOnBackend({
        idToken,
        reservationId: resolvedId,
        reason: payload.reason,
        images: payload.images,
      });
      setReservation((prev) => mergeLoadedItem(prev, updated));
      setShowCancelAcceptedModal(false);
      onChanged?.();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không hủy được đơn.');
      throw actionError;
    } finally {
      setIsActing(false);
    }
  }

  function handleRefundDisputeDeposit() {
    Alert.alert(
      'Hoàn cọc cho người mua?',
      'Tiền cọc sẽ được hoàn về ví người mua và đơn sẽ kết thúc tranh chấp.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Hoàn cọc',
          onPress: async () => {
            setIsActing(true);
            try {
              const idToken = await getCurrentUserIdToken();
              const updated = await refundSellerDisputeDepositOnBackend(idToken, resolvedId);
              setReservation((prev) => mergeLoadedItem(prev, updated));
              onChanged?.();
              Alert.alert('Đã hoàn cọc', 'Tiền cọc đã được hoàn cho người mua.');
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không hoàn cọc được.');
            } finally {
              setIsActing(false);
            }
          },
        },
      ]
    );
  }

  function handleCallBuyer() {
    const phone = reservation?.buyer?.phone;
    if (!phone) {
      Alert.alert('Thông báo', 'Khách chưa có số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
  }

  async function handleSubmitBuyerNoShow(payload) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const result = await reportBuyerNoShowOnBackend({
        idToken,
        reservationId,
        title: payload.title,
        description: payload.description,
        note: payload.note,
        images: payload.images,
      });
      setReservation(result?.reservation || result);
      setShowDisputeModal(false);
      await loadDisputeReports();
      onChanged?.();
      Alert.alert('Đã gửi', 'Đã báo cáo người mua không đến. Cọc đang giữ chờ admin.');
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được báo cáo.');
      throw actionError;
    } finally {
      setIsActing(false);
    }
  }

  async function handleSubmitDisputeResponse(payload) {
    setIsActing(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const updated = await respondSellerPostDeliveryComplaintOnBackend(idToken, {
        reservationId: resolvedId,
        description: payload.description,
        images: payload.images,
      });
      setReservation((prev) => mergeLoadedItem(prev, updated));
      setShowResponseModal(false);
      await loadDisputeReports();
      onChanged?.();
      Alert.alert('Đã gửi', 'Phản hồi khiếu nại đã gửi. Admin sẽ xử lý tranh chấp.');
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được phản hồi.');
      throw actionError;
    } finally {
      setIsActing(false);
    }
  }

  if (isLoading && !reservation) {
    return (
      <OrderDetailLayout onBack={onBack}>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </OrderDetailLayout>
    );
  }

  if (!reservation) {
    return (
      <OrderDetailLayout onBack={onBack}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Không tìm thấy đơn hàng.</Text>
        </View>
      </OrderDetailLayout>
    );
  }

  const canConfirm = reservation.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;
  const pastPickup = isPastPickup(reservation, currentTime);
  const withinDecision = isWithinDepositDecisionWindow(reservation, currentTime);
  const holdingAccepted =
    reservation.status === RESERVATION_STATUS.WAITING_PICKUP &&
    !reservation.disputeByBuyer &&
    !reservation.disputeBySeller;
  const canCancelAccepted =
    reservation.canCancelAccepted === true || holdingAccepted;
  const canReportBuyer =
    reservation.canReportBuyer === true ||
    ((reservation.status === RESERVATION_STATUS.WAITING_PICKUP ||
      reservation.status === RESERVATION_STATUS.DISPUTED) &&
      pastPickup &&
      !reservation.disputeBySeller);
  const canRefundDisputeDeposit =
    !reservation.disputeBySeller &&
    (reservation.canRefundDisputeDeposit === true ||
      (reservation.status === RESERVATION_STATUS.DISPUTED &&
        Number(reservation.depositSettleTo || 0) === 0 &&
        !reservation.depositSettledAt &&
        !reservation.depositReleasedAt &&
        !reservation.depositRefundedAt));
  const showDisputeActions =
    reservation.status === RESERVATION_STATUS.DISPUTED &&
    (canRefundDisputeDeposit || canReportBuyer);
  const showConfirmedNotice =
    reservation.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup;
  const showPastPickupNotice =
    reservation.status === RESERVATION_STATUS.WAITING_PICKUP && pastPickup;
  const showPastPickupActions =
    showPastPickupNotice && (canCancelAccepted || canReportBuyer);
  const showCancelBeforePickup = canCancelAccepted && !pastPickup;
  const canSellerRespondToComplaint = reservation?.canSellerRespondToComplaint === true;
  const sellerResponseCountdownText = canSellerRespondToComplaint
    ? getSellerResponseCountdownLabel(reservation, currentTime)
    : '';
  const buyerName = reservation.buyer?.fullName || 'Khách';
  const buyerId = getReservationBuyerId(reservation);
  const productId = getReservationProductId(reservation);

  function handleOpenBuyer() {
    if (!buyerId) {
      Alert.alert('Thông báo', 'Không xác định được hồ sơ khách hàng.');
      return;
    }
    onOpenBuyer?.({ userId: buyerId, fullName: buyerName });
  }

  function handleOpenProduct() {
    if (!productId) {
      Alert.alert('Thông báo', 'Không xác định được sản phẩm.');
      return;
    }
    onOpenProduct?.({ productId, productName: reservation.product?.productName || '' });
  }

  const statusLabel = getSellerCompletedOrderStatusLabel(reservation.status);
  const statusChipStyle =
    isCancelledReservationStatus(reservation.status) ||
    reservation.status === RESERVATION_STATUS.DISPUTED
      ? styles.statusChipCancelled
      : reservation.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION ||
          reservation.status === RESERVATION_STATUS.WAITING_PICKUP
        ? styles.statusChipPending
        : styles.statusChip;
  const pickupDisplay = formatPickupSchedule(reservation.pickupTime);
  const cancelReasonText =
    String(listCancelReasonText || '').trim() ||
    getCancelledReservationReason(reservation, VIEWER_ROLE.SELLER);
  const sellerCancelNote = getSellerCancelNote(reservation);
  const sellerCancelImages = Array.isArray(reservation.sellerCancelImages)
    ? reservation.sellerCancelImages.filter(Boolean)
    : [];
  const showSellerCancelEvidence =
    isSellerCancelAfterAcceptOrder(reservation) &&
    !(hasDisputeReportHistory(reservation) && !isActiveDisputeOrder(reservation));
  const showAdminResolutionSection = hasAdminDisputeResolution(reservation, disputeReports);
  const showCancelReasonSection =
    !isActiveDisputeOrder(reservation) &&
    !showAdminResolutionSection &&
    (Boolean(cancelReasonText) ||
      (showSellerCancelEvidence && Boolean(sellerCancelNote)) ||
      (showSellerCancelEvidence && sellerCancelImages.length > 0));
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
  const buyerReport = disputeReports.find((report) => report.reporterSide === 'buyer');
  const sellerReport = disputeReports.find((report) => report.reporterSide === 'seller');
  const isCompletedOrder =
    reservation.status === RESERVATION_STATUS.COMPLETED ||
    reservation.status === RESERVATION_STATUS.AUTO_COMPLETED;
  const buyerReview =
    isCompletedOrder && reservation.buyerReview?.id ? reservation.buyerReview : null;
  const escrowDepositCountdown = getSellerDepositReleaseCountdownLabel(
    reservation,
    currentTime
  );

  return (
    <OrderDetailLayout onBack={onBack}>
      <View style={styles.card}>
        <View style={styles.orderMetaRow}>
          <Text style={styles.orderCode} numberOfLines={1}>
            Đơn hàng: {getOrderCodeValue(reservation.id || reservationId)}
          </Text>
          <Text style={statusChipStyle} numberOfLines={2}>
            {statusLabel}
          </Text>
        </View>

        {escrowDepositCountdown ? (
          <Text style={styles.escrowDepositCountdown}>{escrowDepositCountdown}</Text>
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.sectionHeading}>THÔNG TIN KHÁCH HÀNG</Text>
        <View style={styles.buyerRow}>
          <Pressable
            style={({ pressed }) => [styles.buyerTapArea, pressed && styles.tapAreaPressed]}
            onPress={handleOpenBuyer}
            accessibilityRole="button"
            accessibilityLabel={`Xem hồ sơ ${buyerName}`}
          >
            <AvatarBadge name={buyerName} uri={reservation.buyer?.avatar || ''} size={52} />
            <View style={styles.buyerInfo}>
              <Text style={styles.buyerName} numberOfLines={1}>
                {buyerName}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>
          <Pressable
            onPress={handleCallBuyer}
            style={({ pressed }) => [styles.callIconBtn, pressed && styles.callIconBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Gọi khách"
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
        <PaymentRow label={`Đặt cọc ${depositPercent}%:`} value={formatPrice(depositAmount)} />
        <PaymentRow
          label="Thanh toán khi nhận hàng:"
          value={formatPrice(cashDue)}
          valueStyle={styles.paymentValueDanger}
        />

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

        {reservation.note ? <Text style={styles.noteLine}>Ghi chú: {reservation.note}</Text> : null}

        {showConfirmedNotice ? (
          <>
            <View style={styles.divider} />
            <View style={styles.pickupNoticeBlock}>
              <Text style={styles.pickupNoticeTitle}>ĐÃ XÁC NHẬN ĐƠN</Text>
              <Text style={styles.pickupNoticeBody}>
                Đưa QR gian hàng cho khách quét trên đơn của họ để hoàn tất.
              </Text>
            </View>
          </>
        ) : null}

        {showPastPickupNotice ? (
          <>
            <View style={styles.divider} />
            <View style={styles.pickupNoticeBlock}>
              <Text style={styles.pickupOverdueTitle}>ĐÃ QUÁ GIỜ NHẬN HÀNG</Text>
              <Text style={styles.pickupNoticeBody}>
                {withinDecision
                  ? 'Trong 24h bạn có thể khiếu nại và chờ admin xử lý hoặc hoàn cọc cho người mua.'
                  : 'Đã quá 24 giờ sau giờ nhận. Cọc mặc định đã chuyển cho bạn.'}
              </Text>
            </View>
          </>
        ) : null}

        {buyerReview ? (
          <SellerOrderReviewSection
            review={buyerReview}
            shopId={reservation.shopId ? String(reservation.shopId) : ''}
            shopName={reservation.storeName || reservation.shop?.shopName || ''}
            buyerName={buyerName}
            disabled={isActing}
          />
        ) : null}

        <View style={styles.divider} />
        <ReservationAdjustmentSection reservation={reservation} />

        <ReservationDisputeSection
          reservation={reservation}
          buyerReport={buyerReport}
          sellerReport={sellerReport}
          viewerRole={VIEWER_ROLE.SELLER}
        />

        <ReservationAdminResolutionSection
          reservation={reservation}
          reports={disputeReports}
          viewerRole={VIEWER_ROLE.SELLER}
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
            {!showSellerCancelEvidence || !sellerCancelImages.length ? null : (
              <View style={styles.cancelEvidenceBlock}>
                <Text style={styles.cancelDetailLabel}>Ảnh minh chứng</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {sellerCancelImages.map((uri) => (
                    <Image key={uri} source={{ uri }} style={styles.evidencePhoto} />
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        {canConfirm ? (
          <View style={styles.confirmActionRow}>
            <Pressable
              disabled={isActing}
              onPress={handleConfirm}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Đồng ý</Text>
            </Pressable>
            <Pressable
              disabled={isActing}
              onPress={handleReject}
              style={styles.outlineDangerBtn}
            >
              <Text style={styles.outlineDangerBtnText}>Từ chối</Text>
            </Pressable>
          </View>
        ) : null}
        {showDisputeActions ? (
          <View style={styles.pastPickupActionCol}>
            {canRefundDisputeDeposit ? (
              <Pressable
                disabled={isActing}
                onPress={handleRefundDisputeDeposit}
                style={styles.refundBtn}
              >
                <Text style={styles.refundBtnText}>Hoàn cọc cho người mua</Text>
              </Pressable>
            ) : null}
            {canReportBuyer ? (
              <Pressable
                disabled={isActing}
                onPress={() => setShowDisputeModal(true)}
                style={styles.reportBtn}
              >
                <Text style={styles.reportBtnText}>Báo cáo người mua không đến</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {showPastPickupActions ? (
          <View style={styles.pastPickupActionCol}>
            {canCancelAccepted ? (
              <Pressable
                disabled={isActing}
                onPress={handleOpenCancelAccepted}
                style={styles.refundBtn}
              >
                <Text style={styles.refundBtnText}>Hoàn cọc cho người mua</Text>
              </Pressable>
            ) : null}
            {canReportBuyer ? (
              <Pressable
                disabled={isActing}
                onPress={() => setShowDisputeModal(true)}
                style={styles.reportBtn}
              >
                <Text style={styles.reportBtnText}>Báo cáo người mua không đến</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {showCancelBeforePickup ? (
          <Pressable
            disabled={isActing}
            onPress={handleOpenCancelAccepted}
            style={styles.dangerBtn}
          >
            <Text style={styles.dangerBtnText}>Hủy đơn (hoàn cọc)</Text>
          </Pressable>
        ) : null}
        {canSellerRespondToComplaint ? (
          <Pressable
            disabled={isActing}
            onPress={() => setShowResponseModal(true)}
            style={[styles.primaryBtn, sellerResponseCountdownText ? styles.actionBtnStacked : null]}
          >
            <Text style={styles.primaryBtnText}>Phản hồi khiếu nại</Text>
            {sellerResponseCountdownText ? (
              <Text style={styles.responseCountdownText}>{sellerResponseCountdownText}</Text>
            ) : null}
          </Pressable>
        ) : null}
        {!showPastPickupActions && !showDisputeActions && canReportBuyer ? (
          <Pressable
            disabled={isActing}
            onPress={() => setShowDisputeModal(true)}
            style={styles.reportBtn}
          >
            <Text style={styles.reportBtnText}>Báo cáo người mua không đến</Text>
          </Pressable>
        ) : null}
      </View>

      <ReservationDisputeModal
        visible={showDisputeModal}
        mode="seller"
        onClose={() => setShowDisputeModal(false)}
        onSubmit={handleSubmitBuyerNoShow}
      />
      <ReservationDisputeModal
        visible={showResponseModal}
        mode="seller_response"
        onClose={() => setShowResponseModal(false)}
        onSubmit={handleSubmitDisputeResponse}
      />
      <SellerCancelAcceptedModal
        visible={showCancelAcceptedModal}
        onClose={() => setShowCancelAcceptedModal(false)}
        onSubmit={handleSubmitCancelAccepted}
      />
    </OrderDetailLayout>
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
  },
  centered: { alignItems: 'center', paddingVertical: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
    marginBottom: 10,
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
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderCode: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
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
  escrowDepositCountdown: {
    marginTop: 8,
    color: '#ea580c',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  escrowHoldCard: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  escrowHoldText: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  buyerTapArea: {
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
  buyerInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  buyerName: {
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
  cancelEvidenceBlock: { marginTop: 10, gap: 6 },
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
  actionRow: { gap: 10, marginTop: 4 },
  pastPickupActionCol: {
    gap: 10,
  },
  confirmActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  actionBtnStacked: {
    paddingVertical: 10,
    gap: 2,
  },
  responseCountdownText: {
    color: '#dcfce7',
    fontWeight: '700',
    fontSize: 11,
  },
  outlineDangerBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineDangerBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  dangerBtn: {
    flex: 1,
    minWidth: '40%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { color: '#ffffff', fontWeight: '800' },
  refundBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  refundBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  reportBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reportBtnText: {
    color: '#c2410c',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
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
  evidenceTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  evidenceBody: { fontSize: 13, color: '#334155', fontWeight: '600', lineHeight: 18 },
  evidenceMeta: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  evidencePhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  emptyText: {
    padding: 24,
    textAlign: 'center',
    color: '#64748b',
    fontWeight: '600',
  },
});

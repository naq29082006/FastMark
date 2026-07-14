import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import CircularBackButton from '../shared/components/CircularBackButton';
import {
  acceptBuyerCounterOnBackend,
  cancelBuyerReservationOnBackend,
  counterBuyerDealOnBackend,
  getBuyerOrdersOnBackend,
  resubmitBuyerDealOnBackend,
} from '../../api/buyerOpsApi';
import { RESERVATION_TAB, DEAL_OFFER_STATUS, RESERVATION_STATUS } from '../../constants/sellerOrders';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { formatPrice } from '../../core/utils/productFormat';
import { formatOrderCode } from '../../core/utils/orderCode';
import { submitShopReview } from '../../core/utils/orderReview';
import { useReviewedOrderCodes } from '../../hooks/useReviewedOrderCodes';
import ShopReviewModal from '../shared/components/ShopReviewModal';
import ReservationModal from './ReservationModal';
import BuyerOrderDetailScreen from './BuyerOrderDetailScreen';

const TABS = [
  { key: 'pending_price', label: 'Deal giá' },
  { key: 'holding', label: 'Giữ hàng' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
];

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

function getDealStatusStyle(status) {
  if (status === DEAL_OFFER_STATUS.ACCEPTED) {
    return { badge: styles.statusBadgeSuccess, text: styles.statusBadgeTextSuccess };
  }
  if (status === DEAL_OFFER_STATUS.REJECTED) {
    return { badge: styles.statusBadgeDanger, text: styles.statusBadgeTextDanger };
  }
  return { badge: styles.statusBadgePending, text: styles.statusBadgeTextPending };
}

function getReservationStatusStyle(status) {
  if (status === RESERVATION_STATUS.CONFIRMED) {
    return { badge: styles.statusBadgeSuccess, text: styles.statusBadgeTextSuccess };
  }
  if (status === RESERVATION_STATUS.COMPLETED) {
    return { badge: styles.statusBadgeInfo, text: styles.statusBadgeTextInfo };
  }
  if (status === RESERVATION_STATUS.CANCELLED) {
    return { badge: styles.statusBadgeDanger, text: styles.statusBadgeTextDanger };
  }
  return { badge: styles.statusBadgePending, text: styles.statusBadgeTextPending };
}

function formatDateTime(iso) {
  if (!iso) {
    return '';
  }
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function normalizeOrderItem(item) {
  if (!item) {
    return item;
  }
  return {
    ...item,
    id: String(item.id || item._id || '').trim(),
    shopId: item.shopId ? String(item.shopId) : '',
    storeName: pickStoreName(item.storeName, item.shopUsername, item.shop?.shopName),
  };
}

function ReservationProgress({ status }) {
  if (status === RESERVATION_STATUS.CANCELLED) {
    return (
      <View style={styles.progressTrack}>
        <View style={[styles.progressDot, styles.progressDotCancelled]} />
        <Text style={styles.progressCancelled}>Đơn đã hủy</Text>
      </View>
    );
  }

  const steps = [
    { label: 'Chờ', done: status >= RESERVATION_STATUS.PENDING },
    { label: 'Xác nhận', done: status >= RESERVATION_STATUS.CONFIRMED },
    { label: 'Hoàn thành', done: status >= RESERVATION_STATUS.COMPLETED },
  ];
  const activeIndex =
    status === RESERVATION_STATUS.PENDING
      ? 0
      : status === RESERVATION_STATUS.CONFIRMED
        ? 1
        : 2;

  return (
    <View style={styles.progressTrack}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.progressStepWrap}>
          {index > 0 ? (
            <View
              style={[
                styles.progressLine,
                index <= activeIndex && styles.progressLineActive,
              ]}
            />
          ) : null}
          <View
            style={[
              styles.progressDot,
              index <= activeIndex && styles.progressDotActive,
            ]}
          />
          <Text
            style={[
              styles.progressLabel,
              index <= activeIndex && styles.progressLabelActive,
            ]}
          >
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BuyerOrdersContent({
  activeTab,
  onOpenStore,
  onNavigatePickup,
  onReserveFromDeal,
  onReviewStore,
  onOpenDetail,
  pendingDealModal = null,
  onClearPendingDealModal,
  reviewedOrderCodes,
  refreshKey = 0,
}) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [resubmitDeal, setResubmitDeal] = useState(null);
  const [resubmitPrice, setResubmitPrice] = useState('');
  const [priceModalMode, setPriceModalMode] = useState('resubmit');

  const loadOrders = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getBuyerOrdersOnBackend({
        idToken,
        tab: activeTab,
        search: search.trim() || undefined,
      });
      if (activeTab === RESERVATION_TAB.PENDING_PRICE) {
        setItems(data.deals || []);
      } else {
        setItems(data.reservations || []);
      }
    } catch (loadError) {
      setError(loadError.message || 'Không tải được đơn hàng.');
      setItems([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, search, refreshKey]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function handleAcceptCounter(deal) {
    Alert.alert(
      'Chấp nhận giá shop',
      `Bạn đồng ý mua với tổng ${formatPrice(deal.sellerCounterPrice)} (${deal.quantity || 1} sp)?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đồng ý',
          onPress: async () => {
            try {
              const idToken = await getCurrentUserIdToken();
              const updatedDeal = await acceptBuyerCounterOnBackend(idToken, deal.id);
              loadOrders(true);
              onReserveFromDeal?.(updatedDeal || { ...deal, status: DEAL_OFFER_STATUS.ACCEPTED });
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không thể chấp nhận giá.');
            }
          },
        },
      ]
    );
  }

  function handleNavigatePickup(item) {
    onNavigatePickup?.({
      shopId: item.shopId,
      reservationId: String(item.id),
      storeName: item.storeName,
    });
  }

  function handleResubmitDeal(deal) {
    setPriceModalMode('resubmit');
    setResubmitDeal(deal);
    setResubmitPrice(String(deal.offeredPrice || ''));
  }

  function handleCounterDeal(deal) {
    setPriceModalMode('counter');
    setResubmitDeal(deal);
    setResubmitPrice('');
  }

  useEffect(() => {
    if (!pendingDealModal?.deal) {
      return;
    }
    if (pendingDealModal.mode === 'counter') {
      handleCounterDeal(pendingDealModal.deal);
    } else {
      handleResubmitDeal(pendingDealModal.deal);
    }
    onClearPendingDealModal?.();
  }, [pendingDealModal]);

  async function submitResubmitDeal() {
    const offeredPrice = Number(String(resubmitPrice || '').replace(/\D/g, ''));
    if (!resubmitDeal || !offeredPrice) {
      Alert.alert('Lỗi', 'Giá không hợp lệ.');
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      if (priceModalMode === 'counter') {
        await counterBuyerDealOnBackend({
          idToken,
          dealId: resubmitDeal.id,
          offeredPrice,
        });
      } else {
        await resubmitBuyerDealOnBackend({
          idToken,
          dealId: resubmitDeal.id,
          offeredPrice,
        });
      }
      setResubmitDeal(null);
      loadOrders(true);
    } catch (actionError) {
      Alert.alert(
        'Lỗi',
        actionError.message ||
          (priceModalMode === 'counter' ? 'Không gửi được đề nghị mới.' : 'Không gửi lại được đề nghị.')
      );
    }
  }

  function handleCancelReservation(reservation) {
    Alert.alert(
      'Hủy giữ hàng',
      'Bạn có chắc muốn hủy yêu cầu giữ hàng này?',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy đơn',
          style: 'destructive',
          onPress: async () => {
            try {
              const idToken = await getCurrentUserIdToken();
              await cancelBuyerReservationOnBackend(idToken, reservation.id);
              loadOrders(true);
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không hủy được đơn.');
            }
          },
        },
      ]
    );
  }

  function renderDealItem({ item }) {
    const statusLabel = DEAL_STATUS_LABELS[item.status] || 'Không rõ';
    const statusStyle = getDealStatusStyle(item.status);
    const qty = Number(item.quantity) || 1;
    const originalUnit = Number(item.originalPrice) || 0;
    const originalTotal = originalUnit * qty;
    let offeredTotal = Number(item.offeredPrice) || 0;
    // Legacy deals stored unit offers
    if (originalUnit > 0 && offeredTotal > 0 && offeredTotal <= originalUnit) {
      offeredTotal *= qty;
    }
    const canReserve =
      item.status === DEAL_OFFER_STATUS.ACCEPTED && !item.reservationId;
    const canResubmit =
      item.status === DEAL_OFFER_STATUS.REJECTED ||
      (item.status === DEAL_OFFER_STATUS.ACCEPTED && !item.reservationId);
    const canAcceptCounter =
      item.status === DEAL_OFFER_STATUS.PENDING && item.sellerCounterPrice;
    const canCounter =
      item.status === DEAL_OFFER_STATUS.PENDING && item.sellerCounterPrice;

    return (
      <View style={styles.card}>
        <Pressable onPress={() => onOpenDetail?.({ kind: 'deal', item: normalizeOrderItem(item) })}>
          <Text style={styles.orderCode}>{formatOrderCode(item.id)}</Text>
          <View style={styles.cardTopRow}>
            <View style={styles.cardIconWrap}>
              <Text style={styles.cardIcon}>💬</Text>
            </View>
            <View style={styles.cardMain}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.productName}</Text>
                <View style={[styles.statusBadge, statusStyle.badge]}>
                  <Text style={[styles.statusBadgeText, statusStyle.text]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {item.variantName} • {pickStoreName(item.storeName, item.shopUsername)} • SL: {qty}
              </Text>
              <Text style={styles.priceText}>
                Tổng {formatPrice(originalTotal)} → {formatPrice(offeredTotal)}
              </Text>
              <Text style={styles.cardMeta}>
                Giảm {item.discountPercent || 0}% • {formatDateTime(item.createdAt)}
              </Text>
              {item.sellerCounterPrice ? (
                <View style={styles.highlightBox}>
                  <Text style={styles.counterText}>
                    Shop đề xuất tổng:{' '}
                    {formatPrice(
                      Number(item.originalPrice) > 0 &&
                        Number(item.sellerCounterPrice) <= Number(item.originalPrice)
                        ? Number(item.sellerCounterPrice) * qty
                        : item.sellerCounterPrice
                    )}
                  </Text>
                </View>
              ) : item.status === DEAL_OFFER_STATUS.PENDING ? (
                <Text style={styles.waitText}>Đang chờ shop phản hồi</Text>
              ) : null}
              <Text style={styles.detailLink}>Xem chi tiết →</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.actionRow}>
          {canAcceptCounter ? (
            <Pressable
              style={[styles.actionButton, styles.actionButtonFlex]}
              onPress={() => handleAcceptCounter(item)}
            >
              <Text style={styles.actionButtonText}>Chấp nhận giá</Text>
            </Pressable>
          ) : null}
          {canCounter ? (
            <Pressable
              style={[styles.actionButton, styles.actionButtonSecondary, styles.actionButtonFlex]}
              onPress={() => handleCounterDeal(item)}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                Đề nghị lại
              </Text>
            </Pressable>
          ) : null}
          {canReserve ? (
            <Pressable
              style={[styles.actionButton, styles.actionButtonFlex]}
              onPress={() => onReserveFromDeal?.(item)}
            >
              <Text style={styles.actionButtonText}>Giữ hàng</Text>
            </Pressable>
          ) : null}
          {canResubmit ? (
            <Pressable
              style={[styles.actionButton, styles.actionButtonSecondary, styles.actionButtonFlex]}
              onPress={() => handleResubmitDeal(item)}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                Deal giá lại
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  function renderReservationItem({ item }) {
    const isHolding = activeTab === RESERVATION_TAB.HOLDING;
    const statusStyle = getReservationStatusStyle(item.status);
    const canCancel =
      isHolding && item.status === RESERVATION_STATUS.PENDING && !item.buyerCancelLocked;
    const canReview =
      activeTab === RESERVATION_TAB.COMPLETED &&
      !reviewedOrderCodes?.has(String(item.id));
    const canNavigate = isHolding && item.status === RESERVATION_STATUS.CONFIRMED;
    const storeName = pickStoreName(item.storeName, item.shopUsername, item.shop?.shopName);

    return (
      <View style={styles.card}>
        <Pressable
          onPress={() => onOpenDetail?.({ kind: 'reservation', item: normalizeOrderItem(item) })}
        >
          <Text style={styles.orderCode}>{formatOrderCode(item.id)}</Text>
          <View style={styles.cardTopRow}>
            <View style={styles.cardIconWrap}>
              <Text style={styles.cardIcon}>📦</Text>
            </View>
            <View style={styles.cardMain}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.product?.productName}</Text>
                <View style={[styles.statusBadge, statusStyle.badge]}>
                  <Text style={[styles.statusBadgeText, statusStyle.text]}>
                    {RESERVATION_STATUS_LABELS[item.status] || 'Không rõ'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {item.variant?.variantName} • SL: {item.quantity} • {storeName}
              </Text>
              <Text style={styles.priceText}>
                {formatPrice(item.agreedPrice)}/sp • Tổng {formatPrice(item.totalAmount)}
              </Text>
              {item.pickupTime ? (
                <Text style={styles.pickupText}>🕐 Lấy: {formatDateTime(item.pickupTime)}</Text>
              ) : (
                <Text style={styles.cardMeta}>Giữ lúc: {formatDateTime(item.createdAt)}</Text>
              )}
              {item.status === RESERVATION_STATUS.CANCELLED && item.cancelReason ? (
                <Text style={styles.cancelReasonText}>Lý do: {item.cancelReason}</Text>
              ) : null}
              <Text style={styles.detailLink}>Xem chi tiết →</Text>
            </View>
          </View>
        </Pressable>

        <ReservationProgress status={item.status} />

        <View style={styles.actionRow}>
          {canNavigate ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonFlex,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={() => handleNavigatePickup(item)}
            >
              <Text style={styles.actionButtonText}>🧭 Đến lấy hàng</Text>
            </Pressable>
          ) : null}

          {canCancel ? (
            <Pressable
              style={[styles.actionButton, styles.actionButtonDanger, styles.actionButtonFlex]}
              onPress={() => handleCancelReservation(item)}
            >
              <Text style={styles.actionButtonTextDanger}>Hủy giữ hàng</Text>
            </Pressable>
          ) : null}

          {canReview ? (
            <Pressable
              style={[styles.actionButton, styles.actionButtonSecondary, styles.actionButtonFlex]}
              onPress={() =>
                onReviewStore?.({
                  storeId: item.shopId ? String(item.shopId) : '',
                  storeName,
                  productName: item.product?.productName,
                  orderCode: item.id ? String(item.id) : '',
                })
              }
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                ⭐ Đánh giá
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0d7377" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.contentWrap}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm sản phẩm, cửa hàng..."
          placeholderTextColor="#94a3b8"
          onSubmitEditing={() => loadOrders(true)}
          returnKeyType="search"
        />
        <Pressable style={styles.searchBtn} onPress={() => loadOrders(true)}>
          <Text style={styles.searchBtnText}>Tìm</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={
          activeTab === RESERVATION_TAB.PENDING_PRICE ? renderDealItem : renderReservationItem
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadOrders(true)} tintColor="#0d7377" />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Chưa có đơn trong mục này</Text>
            <Text style={styles.emptyText}>Deal giá và giữ hàng sẽ hiển thị tại đây.</Text>
          </View>
        }
      />
      <Modal visible={Boolean(resubmitDeal)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {priceModalMode === 'counter' ? 'Đề nghị tổng mới' : 'Deal giá lại'}
            </Text>
            {resubmitDeal ? (
              <Text style={styles.modalHint}>
                Tổng niêm yết:{' '}
                {formatPrice(
                  (Number(resubmitDeal.originalPrice) || 0) * (resubmitDeal.quantity || 1)
                )}
                {' • '}
                SL: {resubmitDeal.quantity || 1}
              </Text>
            ) : null}
            {priceModalMode === 'counter' && resubmitDeal?.sellerCounterPrice ? (
              <Text style={styles.modalHint}>
                Shop đề xuất tổng: {formatPrice(resubmitDeal.sellerCounterPrice)}
              </Text>
            ) : null}
            <TextInput
              style={styles.modalInput}
              value={resubmitPrice}
              onChangeText={(value) => setResubmitPrice(value.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder={
                priceModalMode === 'counter' ? 'Tổng bạn muốn đề nghị' : 'Tổng đề nghị mới'
              }
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setResubmitDeal(null)}>
                <Text style={styles.modalCancelText}>Huỷ</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={submitResubmitDeal}>
                <Text style={styles.modalSubmitText}>Gửi</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function BuyerOrdersScreen({
  onOpenStore,
  onNavigatePickup,
  embedded = true,
  onBack,
  onReviewStore,
}) {
  const [activeTab, setActiveTab] = useState(RESERVATION_TAB.HOLDING);
  const [reservationModal, setReservationModal] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [detailTarget, setDetailTarget] = useState(null);
  const [pendingDealModal, setPendingDealModal] = useState(null);
  const { reviewedOrderCodes, markReviewed } = useReviewedOrderCodes();

  const tabBar = (
    <View style={styles.tabRow}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  function handleReserveFromDeal(deal) {
    const qty = Number(deal.quantity) || 1;
    const originalUnit = Number(deal.originalPrice) || 0;
    let agreedTotal = Number(deal.sellerCounterPrice || deal.offeredPrice) || 0;
    if (originalUnit > 0 && agreedTotal > 0 && agreedTotal <= originalUnit) {
      agreedTotal *= qty;
    }
    setReservationModal({
      product: {
        id: deal.productId,
        name: deal.productName,
        variants: [
          {
            id: deal.variantId,
            name: deal.variantName,
            variantName: deal.variantName,
            price: deal.originalPrice,
            quantity: qty,
          },
        ],
      },
      store: { id: deal.shopId, name: deal.storeName },
      dealOfferId: deal.id,
      agreedTotal,
      dealQuantity: qty,
      preselectedVariantId: deal.variantId,
    });
  }

  const body = (
    <>
      <BuyerOrdersContent
        activeTab={activeTab}
        onOpenStore={onOpenStore}
        onNavigatePickup={onNavigatePickup}
        onReserveFromDeal={handleReserveFromDeal}
        onReviewStore={(target) => {
          setReviewTarget(target);
          onReviewStore?.(target);
        }}
        onOpenDetail={setDetailTarget}
        pendingDealModal={pendingDealModal}
        onClearPendingDealModal={() => setPendingDealModal(null)}
        reviewedOrderCodes={reviewedOrderCodes}
        refreshKey={listRefreshKey}
      />
      <ReservationModal
        visible={Boolean(reservationModal)}
        product={reservationModal?.product}
        store={reservationModal?.store}
        dealOfferId={reservationModal?.dealOfferId}
        agreedTotal={reservationModal?.agreedTotal}
        lockedQuantity={reservationModal?.dealQuantity}
        preselectedVariantId={reservationModal?.preselectedVariantId}
        onClose={() => setReservationModal(null)}
        onSuccess={() => {
          setReservationModal(null);
          setActiveTab(RESERVATION_TAB.HOLDING);
          setListRefreshKey((value) => value + 1);
        }}
      />
      <ShopReviewModal
        visible={Boolean(reviewTarget)}
        storeName={reviewTarget?.storeName}
        productName={reviewTarget?.productName}
        onClose={() => setReviewTarget(null)}
        onSubmit={async ({ rating, comment, imageUrl }) => {
          if (!reviewTarget) return;
          try {
            await submitShopReview({
              storeId: reviewTarget.storeId,
              storeName: reviewTarget.storeName,
              productName: reviewTarget.productName,
              orderCode: reviewTarget.orderCode,
              rating,
              comment,
              imageUrl,
            });
            markReviewed({ orderCode: reviewTarget.orderCode });
            setReviewTarget(null);
            Alert.alert('Cảm ơn bạn', 'Đánh giá đã được gửi.');
          } catch (error) {
            Alert.alert('Lỗi', error.message || 'Không gửi được đánh giá.');
          }
        }}
      />
    </>
  );

  if (detailTarget) {
    return (
      <View style={styles.screen}>
        <BuyerOrderDetailScreen
          kind={detailTarget.kind}
          orderId={String(detailTarget.item?.id || '')}
          initialItem={normalizeOrderItem(detailTarget.item)}
          onBack={() => setDetailTarget(null)}
          onChanged={() => setListRefreshKey((value) => value + 1)}
          onReserveFromDeal={(deal) => {
            setDetailTarget(null);
            handleReserveFromDeal(deal);
          }}
          onNavigatePickup={(payload) => {
            setDetailTarget(null);
            onNavigatePickup?.(payload);
          }}
          onReviewStore={(target) => {
            setDetailTarget(null);
            setReviewTarget(target);
            onReviewStore?.(target);
          }}
          onCounterDeal={(deal) => {
            setDetailTarget(null);
            setPendingDealModal({ mode: 'counter', deal });
          }}
          onResubmitDeal={(deal) => {
            setDetailTarget(null);
            setPendingDealModal({ mode: 'resubmit', deal });
          }}
          canReview={
            detailTarget.kind === 'reservation' &&
            activeTab === RESERVATION_TAB.COMPLETED &&
            !reviewedOrderCodes?.has(String(detailTarget.item?.id))
          }
        />
      </View>
    );
  }

  if (embedded) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          {onBack ? (
            <CircularBackButton onPress={onBack} variant="light" />
          ) : (
            <View style={styles.topBarSpacer} />
          )}
          <Text style={styles.title}>Đơn hàng</Text>
          <View style={styles.topBarSpacer} />
        </View>
        {tabBar}
        <View style={styles.body}>{body}</View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, styles.topBarWithBack]}>
        <CircularBackButton onPress={onBack} variant="light" />
        <Text style={styles.title}>Lịch sử giữ hàng</Text>
        <View style={styles.topBarSpacer} />
      </View>
      {tabBar}
      <View style={styles.body}>{body}</View>
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
  topBarWithBack: {
    paddingTop: 12,
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
  tabRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 38,
    marginHorizontal: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  tabItemActive: {
    borderColor: '#0d7377',
    backgroundColor: '#ecfdf5',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#0d7377',
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  searchBtn: {
    minWidth: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCode: {
    marginBottom: 10,
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  detailLink: {
    marginTop: 8,
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  cardTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 20,
  },
  cardMain: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeTextPending: {
    color: '#b45309',
  },
  statusBadgeSuccess: {
    backgroundColor: '#ecfdf5',
  },
  statusBadgeTextSuccess: {
    color: '#0f766e',
  },
  statusBadgeInfo: {
    backgroundColor: '#e0f2fe',
  },
  statusBadgeTextInfo: {
    color: '#0369a1',
  },
  statusBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeTextDanger: {
    color: '#b91c1c',
  },
  cardMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  priceText: {
    color: '#0d7377',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 4,
  },
  counterText: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '700',
  },
  highlightBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pickupText: {
    marginTop: 4,
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelReasonText: {
    marginTop: 4,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  waitText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  progressTrack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  progressStepWrap: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  progressLine: {
    position: 'absolute',
    top: 7,
    right: '50%',
    left: '-50%',
    height: 2,
    backgroundColor: '#e2e8f0',
    zIndex: 0,
  },
  progressLineActive: {
    backgroundColor: '#99f6e4',
  },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 1,
  },
  progressDotActive: {
    backgroundColor: '#0f766e',
  },
  progressDotCancelled: {
    backgroundColor: '#ef4444',
  },
  progressLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
  },
  progressLabelActive: {
    color: '#0f766e',
  },
  progressCancelled: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#b91c1c',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
  },
  actionButtonFlex: {
    flex: 1,
    minWidth: '45%',
  },
  actionButtonSecondary: {
    backgroundColor: '#e0f2f1',
  },
  actionButtonDanger: {
    backgroundColor: '#fee2e2',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  actionButtonTextDanger: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '900',
  },
  actionButtonTextSecondary: {
    color: '#0f766e',
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalHint: {
    fontSize: 14,
    color: '#b45309',
    fontWeight: '700',
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '800',
  },
  modalSubmit: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontWeight: '900',
  },
});

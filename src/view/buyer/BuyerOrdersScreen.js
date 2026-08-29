import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ClearableSearchField from '../shared/components/ClearableSearchField';
import { showErrorAlert } from '../../core/utils/appAlert';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import OrderTabEmptyState, {
  ORDER_TAB_EMPTY_MESSAGE,
  ORDER_TAB_SEARCH_EMPTY_MESSAGE,
} from '../shared/components/OrderTabEmptyState';
import OrderDisputeListHints from '../shared/components/OrderDisputeListHints';
import OrderCancelListHints from '../shared/components/OrderCancelListHints';
import OrderListActionButton, {
  OrderListActionRow,
} from '../shared/components/OrderListActionButton';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import {
  cancelBuyerReservationOnBackend,
  forfeitBuyerDepositOnBackend,
  getBuyerOrdersOnBackend,
  getBuyerReservationOnBackend,
  reportBuyerReservationOnBackend,
} from '../../api/buyerOpsApi';
import {
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_TAB,
  ORDER_STATUS_TABS,
  DISPUTE_SUB_TAB,
  DISPUTE_SUB_TAB_EMPTY_MESSAGE,
  DISPUTE_SUB_TABS,
  COMPLETED_SUB_TAB,
  COMPLETED_SUB_TAB_EMPTY_MESSAGE,
  COMPLETED_SUB_TABS,
  resolveOrdersApiTab,
  getSellerCompletedOrderStatusLabel,
  getReservationTabForStatus,
  isActiveDisputeOrder,
  isDisputeHistoryReadOnlyOrder,
  isDisputeResolvedOrder,
  isCancelledReservationStatus,
  isDeliveredReservationStatus,
  isPostDeliveryComplaintContext,
  getDisputeTabListStatusLabel,
  isDisputeHistoryListStatus,
  VIEWER_ROLE,
} from '../../constants/sellerOrders';
import { getOrderListCancelDisplay, getCompletedTabDepositLine, isCompletedTabDepositPendingLine } from '../../core/utils/orderDisplay';
import { reservationRequiresDeposit } from '../../core/utils/reservationEntity';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { applyReservationRealtimeRow, removeReservationIfLeftTab, syncOrderListAfterMutation } from '../../core/utils/orderRealtimeSync';
import { coalesceReservationFetch } from '../../core/utils/coalesceReservationFetch';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { hasItemId } from '../../core/utils/realtimeList';
import { orderMatchesSearch, isOrderSearchActive } from '../../core/utils/reservationOrderSearch';
import { sortReservationsNewestFirst } from '../../core/utils/reservationOrderSort';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import { formatPrice } from '../../core/utils/productFormat';
import { getBuyerCancelConfirmMessage } from '../../core/utils/buyerCancelReservation';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import {
  submitShopReview,
  canShowReviewButton,
  canShowComplaintButton,
  canViewExistingReview,
  buildViewReviewPayload,
} from '../../core/utils/orderReview';
import ShopReviewModal from '../shared/components/ShopReviewModal';
import MyReviewDetailModal from '../shared/components/MyReviewDetailModal';
import OrderItemHeader from '../shared/components/OrderItemHeader';
import {
  isDepositAlreadySettled,
  isWithinDepositDecisionWindowForItem,
  getOrderCountdownLine,
  getDisputeActionButtonLabel,
  isPastPickupTime,
  getPrePickupDisputeWindowText,
} from '../../core/utils/escrowHold';
import { useOrderTimeNow } from '../../hooks/useOrderTimeNow';
import OrderStatusTabBar from '../shared/components/OrderStatusTabBar';
import OrderListSubFilterCombo from '../shared/components/OrderListSubFilterCombo';
import BuyerOrderDetailScreen from './BuyerOrderDetailScreen';
import BuyerPickupQrDisplayScreen from './BuyerPickupQrDisplayScreen';
import StoreDetailScreen from '../store/StoreDetailScreen';
import ProductDetailScreen from '../store/ProductDetailScreen';
import { deleteBuyerReviewOnBackend } from '../../api/reviewApi';
import { useReviewedOrderCodes } from '../../hooks/useReviewedOrderCodes';

/** Còn trong hạn khiếu nại / giữ cọc. */
function isWithinDepositDecisionWindow(item, now = Date.now()) {
  return isWithinDepositDecisionWindowForItem(item, now);
}

function getReservationStatusStyle(status, { treatReceivedAsCompleted = false } = {}) {
  if (
    treatReceivedAsCompleted &&
    (status === RESERVATION_STATUS.PICKUP_CONFIRMED ||
      status === RESERVATION_STATUS.RECEIVED)
  ) {
    return { badge: styles.statusBadgeSuccess, text: styles.statusBadgeTextSuccess };
  }
  if (status === RESERVATION_STATUS.WAITING_PICKUP) {
    return { badge: styles.statusBadgePending, text: styles.statusBadgeTextPending };
  }
  if (
    status === RESERVATION_STATUS.PICKUP_CONFIRMED ||
    status === RESERVATION_STATUS.RECEIVED
  ) {
    return { badge: styles.statusBadgeInfo, text: styles.statusBadgeTextInfo };
  }
  if (
    status === RESERVATION_STATUS.COMPLETED ||
    status === RESERVATION_STATUS.AUTO_COMPLETED
  ) {
    return { badge: styles.statusBadgeSuccess, text: styles.statusBadgeTextSuccess };
  }
  if (
    status === RESERVATION_STATUS.REJECTED ||
    status === RESERVATION_STATUS.REFUNDED ||
    status === RESERVATION_STATUS.DISPUTED
  ) {
    return { badge: styles.statusBadgeDanger, text: styles.statusBadgeTextDanger };
  }
  return { badge: styles.statusBadgePending, text: styles.statusBadgeTextPending };
}

function formatOrderTime(iso) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${hours}:${minutes} · ${day}/${month}/${year}`;
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
  const productId = String(
    item.productId || item.product?.id || item.product?._id || ''
  ).trim();
  return {
    ...item,
    id: String(item.id || item._id || '').trim(),
    productId,
    shopId: item.shopId ? String(item.shopId) : '',
    storeName: pickStoreName(item.storeName, item.shopUsername, item.shop?.shopName),
    product: item.product
      ? {
          ...item.product,
          id: String(item.product.id || item.product._id || productId || '').trim(),
        }
      : productId
        ? {
            id: productId,
            productName: item.product?.productName || '',
            thumbnail: item.product?.thumbnail || '',
          }
        : null,
  };
}

function BuyerOrdersContent({
  activeTab,
  apiTab,
  disputeSubTab,
  completedSubTab,
  searchInput,
  setSearchInput,
  search,
  onNavigatePickup,
  onReviewStore,
  onViewReview,
  onOpenDetail,
  onOpenShopScan,
  reviewedOrderCodes,
  reviewsByOrderId,
  orderReviewPatches = {},
  refreshKey = 0,
  embedded = true,
  isScreenActive = true,
}) {
  const insets = useScreenInsets();
  const holdingListExtra = activeTab === RESERVATION_TAB.HOLDING ? 56 : 0;
  const listPaddingBottom =
    (embedded ? insets.tabRootScrollPaddingBottom : insets.nestedScrollPaddingBottom) +
    holdingListExtra;
  const [items, setItems] = useState([]);
  // Đọc danh sách hiện tại trong handler realtime mà không cần thêm dependency.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedApiTab, setLoadedApiTab] = useState(apiTab);
  const ordersFetchSeqRef = useRef(0);
  const loadingMoreGuardRef = useRef(false);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const pickupScheduleItems = useMemo(() => {
    if (activeTab !== RESERVATION_TAB.HOLDING) {
      return [];
    }
    return items.filter((row) => row.status === RESERVATION_STATUS.WAITING_PICKUP);
  }, [activeTab, items]);

  const loadOrders = useCallback(async ({ refresh = false, nextPage = 1, silent = false } = {}) => {
    const fetchSeq = ++ordersFetchSeqRef.current;

    if (nextPage > 1) {
      if (loadingMoreGuardRef.current) {
        return;
      }
      loadingMoreGuardRef.current = true;
    }

    if (nextPage === 1) {
      if (refresh) {
        setIsRefreshing(true);
      } else if (!silent) {
        setIsLoading(true);
      }
    } else {
      setIsLoadingMore(true);
    }

    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getBuyerOrdersOnBackend({
        idToken,
        tab: apiTab,
        search: search.trim() || undefined,
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      if (fetchSeq !== ordersFetchSeqRef.current) {
        return;
      }
      const rows = data?.reservations || data?.items || [];
      setItems((current) =>
        nextPage === 1 ? rows : appendUniqueById(current, rows)
      );
      setPage(Number(data?.page) || nextPage);
      setHasMore(
        typeof data?.hasMore === 'boolean'
          ? data.hasMore
          : rows.length >= DEFAULT_PAGE_SIZE
      );
      setTotalCount(
        Number.isFinite(Number(data?.total))
          ? Math.max(0, Number(data.total))
          : (nextPage - 1) * DEFAULT_PAGE_SIZE +
            rows.length +
            (data?.hasMore ? DEFAULT_PAGE_SIZE : 0)
      );
      if (nextPage === 1) {
        setLoadedApiTab(apiTab);
      }
    } catch (loadError) {
      if (fetchSeq !== ordersFetchSeqRef.current) {
        return;
      }
      showErrorAlert(loadError.message || 'Không tải được đơn hàng.');
      if (nextPage === 1) {
        setItems([]);
        setHasMore(false);
        setTotalCount(0);
        setLoadedApiTab(apiTab);
      }
    } finally {
      if (nextPage > 1) {
        loadingMoreGuardRef.current = false;
      }
      if (fetchSeq !== ordersFetchSeqRef.current) {
        return;
      }
      if (nextPage === 1) {
        setIsRefreshing(false);
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [apiTab, search]);

  const handlePickupBoundary = useCallback(() => {
    loadOrders({ nextPage: 1, silent: true });
  }, [loadOrders]);

  const currentTime = useOrderTimeNow({
    enabled: isScreenActive,
    items: pickupScheduleItems,
    onPickupBoundary: handlePickupBoundary,
  });

  useEffect(() => {
    if (!isScreenActive || activeTab !== RESERVATION_TAB.HOLDING) {
      return undefined;
    }
    const timer = setInterval(() => {
      loadOrders({ nextPage: 1, silent: true });
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [activeTab, isScreenActive, loadOrders]);

  useEffect(() => {
    ordersFetchSeqRef.current += 1;
    loadingMoreGuardRef.current = false;
    setItems([]);
    setPage(1);
    setHasMore(true);
    setTotalCount(0);
    setIsLoading(true);
    setIsRefreshing(false);
  }, [apiTab]);

  useEffect(() => {
    loadOrders({ nextPage: 1 });
  }, [loadOrders]);

  const prevRefreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (prevRefreshKeyRef.current === refreshKey) {
      return;
    }
    prevRefreshKeyRef.current = refreshKey;
    if (refreshKey > 0) {
      loadOrders({ nextPage: 1, silent: true });
    }
  }, [refreshKey, loadOrders]);

  const syncListAfterMutation = useCallback(
    (reservation, reservationId) => {
      syncOrderListAfterMutation({
        reservation,
        reservationId,
        activeTab,
        disputeSubTab: activeTab === RESERVATION_TAB.DISPUTE ? disputeSubTab : null,
        completedSubTab: activeTab === RESERVATION_TAB.COMPLETED ? completedSubTab : null,
        search,
        itemsRef,
        setItems,
        setTotalCount,
        loadOrders,
      });
    },
    [activeTab, disputeSubTab, completedSubTab, search, loadOrders]
  );

  /**
   * Realtime: chỉ đồng bộ đúng đơn vừa thay đổi (không tải lại cả danh sách).
   * - Đơn còn thuộc tab đang xem → tải riêng đơn đó và thay tại chỗ.
   * - Đơn đã chuyển sang tab khác → bỏ khỏi danh sách hiện tại.
   */
  const handleOrderUpdated = useCallback(
    async (payload) => {
      const reservationId = String(payload?.reservationId || payload?.id || '').trim();
      if (!reservationId) {
        return;
      }

      if (
        removeReservationIfLeftTab({
          payloadStatus: payload?.status,
          reservationId,
          activeTab,
          currentItems: itemsRef.current,
          setItems,
          setTotalCount,
        })
      ) {
        return;
      }

      const isInList = hasItemId(itemsRef.current, reservationId);
      const eventTab = getReservationTabForStatus(payload?.status);
      const belongsToTab =
        activeTab === RESERVATION_TAB.ALL || eventTab === activeTab;
      const hasSearch = String(search || '').trim().length > 0;

      if (!isInList && (!belongsToTab || hasSearch)) {
        return;
      }

      try {
        const reservation = await coalesceReservationFetch('buyer', reservationId, async () => {
          const idToken = await getCurrentUserIdToken();
          if (!idToken) {
            return null;
          }
          return getBuyerReservationOnBackend(idToken, reservationId);
        });
        if (!reservation?.id) {
          return;
        }
        applyReservationRealtimeRow({
          reservation,
          reservationId,
          activeTab,
          disputeSubTab: activeTab === RESERVATION_TAB.DISPUTE ? disputeSubTab : null,
        completedSubTab: activeTab === RESERVATION_TAB.COMPLETED ? completedSubTab : null,
          search,
          currentItems: itemsRef.current,
          setItems,
          setTotalCount,
        });
      } catch {
        // Giữ danh sách hiện tại nếu tải lỗi.
      }
    },
    [activeTab, disputeSubTab, completedSubTab, search]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading || isRefreshing || isLoadingMore || loadingMoreGuardRef.current) {
      return;
    }
    loadOrders({ nextPage: page + 1 });
  }, [hasMore, isLoading, isRefreshing, isLoadingMore, loadOrders, page]);

  useOrderSocket({
    enabled: isScreenActive,
    onOrderUpdated: handleOrderUpdated,
  });

  const visibleItems = useMemo(() => {
    let list = items;
    if (activeTab === RESERVATION_TAB.HOLDING) {
      list = list.filter((item) => !isCancelledReservationStatus(item.status));
    }
    if (isOrderSearchActive(searchInput)) {
      list = list.filter((item) => orderMatchesSearch(item, searchInput, 'buyer'));
    }
    return sortReservationsNewestFirst(list, activeTab);
  }, [activeTab, items, searchInput]);

  function handleNavigatePickup(item) {
    onNavigatePickup?.({
      shopId: item.shopId,
      reservationId: String(item.id),
      storeName: item.storeName,
    });
  }

  function handleCancelReservation(reservation) {
    Alert.alert(
      'Hủy đơn hàng?',
      getBuyerCancelConfirmMessage(reservation),
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy đơn',
          style: 'destructive',
          onPress: async () => {
            try {
              const idToken = await getCurrentUserIdToken();
              const updated = await cancelBuyerReservationOnBackend(idToken, reservation.id);
              syncListAfterMutation(updated, reservation.id);
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không hủy được đơn.');
            }
          },
        },
      ]
    );
  }

  function handleShowPickupQr(reservation) {
    onOpenShopScan?.(reservation);
  }

  function handleReportShop(reservation) {
    setDisputeTarget(reservation);
  }

  async function handleSubmitDispute(payload) {
    if (!disputeTarget?.id) {
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      const reservationId = disputeTarget.id;
      const updated = await reportBuyerReservationOnBackend(idToken, {
        reservationId,
        reason: payload.reason,
        description: payload.description,
        images: payload.images,
      });
      setDisputeTarget(null);
      Alert.alert(
        'Đã gửi',
        isPostDeliveryComplaintContext(updated || disputeTarget)
          ? 'Khiếu nại đã gửi tới shop. Shop có 2 ngày phản hồi, sau đó admin sẽ xử lý.'
          : 'Khiếu nại đã gửi. Admin sẽ xử lý, cọc tạm giữ.'
      );
      syncListAfterMutation(updated, reservationId);
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được khiếu nại.');
      throw actionError;
    }
  }

  function handleForfeitDeposit(reservation) {
    Alert.alert(
      'Đồng ý mất cọc',
      'Bạn xác nhận không khiếu nại và đồng ý chuyển tiền cọc cho người bán?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý mất cọc',
          style: 'destructive',
          onPress: async () => {
            try {
              const idToken = await getCurrentUserIdToken();
              const updated = await forfeitBuyerDepositOnBackend(idToken, reservation.id);
              Alert.alert('Xong', 'Cọc đã chuyển cho người bán.');
              syncListAfterMutation(updated, reservation.id);
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không xử lý được mất cọc.');
            }
          },
        },
      ]
    );
  }

  function handleHoldingMoreMenu(item) {
    handleCancelReservation(item);
  }

  function renderReservationItem({ item: rawItem }) {
    const patch = orderReviewPatches[String(rawItem.id || '')] || null;
    const item = patch ? { ...rawItem, ...patch } : rawItem;
    const isCompletedTab = activeTab === RESERVATION_TAB.COMPLETED;
    const isPendingTab = activeTab === RESERVATION_TAB.PENDING;
    const isHolding = activeTab === RESERVATION_TAB.HOLDING;
    const isDisputeTab = activeTab === RESERVATION_TAB.DISPUTE;
    const isCancelledTab = activeTab === RESERVATION_TAB.CANCELLED;
    const statusLabel = isDisputeTab
      ? getDisputeTabListStatusLabel(item, disputeSubTab)
      : isCompletedTab
        ? getSellerCompletedOrderStatusLabel(item.status)
        : RESERVATION_STATUS_LABELS[item.status] || 'Không rõ';
    const statusStyle =
      isDisputeTab && isDisputeHistoryListStatus(item, disputeSubTab)
        ? { badge: styles.statusBadgeSuccess, text: styles.statusBadgeTextSuccess }
        : getReservationStatusStyle(item.status);
    const pastPickup = isPastPickupTime(item, currentTime);
    const isDisputeHistoryReadOnly = isDisputeHistoryReadOnlyOrder(item);
    const canCancel =
      (isPendingTab || isHolding) &&
      (item.canCancel === true ||
        item.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION ||
        (item.status === RESERVATION_STATUS.WAITING_PICKUP && !pastPickup));
    const canShowPickupQr =
      isHolding &&
      !pastPickup &&
      (item.canShowPickupQr === true ||
        item.status === RESERVATION_STATUS.WAITING_PICKUP);
    const canReportRaw =
      !isDisputeHistoryReadOnly &&
      !item.disputeByBuyer &&
      (item.canComplaint === true ||
        item.canReportShop === true ||
        (isDeliveredReservationStatus(item.status) &&
          isWithinDepositDecisionWindow(item, currentTime)) ||
        (item.status === RESERVATION_STATUS.WAITING_PICKUP &&
          pastPickup &&
          isWithinDepositDecisionWindow(item, currentTime)) ||
        item.status === RESERVATION_STATUS.DISPUTED);
    const canReport =
      canReportRaw &&
      !isDepositAlreadySettled(item) &&
      canShowComplaintButton(item, reviewsByOrderId) &&
      (item.canComplaint === true ||
        item.canReportShop === true ||
        item.status === RESERVATION_STATUS.DISPUTED ||
        isWithinDepositDecisionWindow(item, currentTime));
    const canForfeitDeposit =
      !isDisputeHistoryReadOnly &&
      !item.disputeByBuyer &&
      !isDepositAlreadySettled(item) &&
      (item.canForfeitDeposit === true ||
        (item.canForfeitDeposit !== false &&
          (item.status === RESERVATION_STATUS.WAITING_PICKUP ||
            item.status === RESERVATION_STATUS.DISPUTED) &&
          pastPickup &&
          isWithinDepositDecisionWindow(item, currentTime)));
    const storeName = pickStoreName(item.storeName, item.shopUsername, item.shop?.shopName);
    const productName = item.product?.productName || 'Sản phẩm';
    const canReview =
      isCompletedTab &&
      item.canReview !== false &&
      isDeliveredReservationStatus(item.status) &&
      canShowReviewButton(item, reviewedOrderCodes);
    const canViewReview = canViewExistingReview(item, reviewsByOrderId);
    const existingReview = canViewReview
      ? buildViewReviewPayload(item, reviewsByOrderId, { storeName, productName })
      : null;
    const canNavigate =
      isHolding &&
      item.status === RESERVATION_STATUS.WAITING_PICKUP &&
      !pastPickup;
    const thumb = item.product?.thumbnail || '';
    const qty = Number(item.quantity) || 0;
    const cancelDisplay = getOrderListCancelDisplay(item, VIEWER_ROLE.BUYER);
    const cancelReasonText = cancelDisplay.reasonLine;
    const countdownLine =
      isCompletedTab || isActiveDisputeOrder(item)
        ? ''
        : getOrderCountdownLine(item, currentTime, VIEWER_ROLE.BUYER);
    const showPickupTimeLine = !isDisputeTab && !isCompletedTab && !isCancelledTab;
    const showDisputeItemActions =
      isDisputeTab &&
      disputeSubTab === DISPUTE_SUB_TAB.ACTIVE &&
      isActiveDisputeOrder(item) &&
      (canReport || canForfeitDeposit);
    const useBlackOrderCode =
      isPendingTab ||
      isHolding ||
      isDisputeTab ||
      isCompletedTab ||
      activeTab === RESERVATION_TAB.CANCELLED;
    const useBlackUnitPrice = isPendingTab || isHolding;
    const unitPrice =
      item.agreedPrice != null
        ? Number(item.agreedPrice)
        : item.variant?.price != null
          ? Number(item.variant.price)
          : qty > 0
            ? Math.round(Number(item.totalAmount || 0) / qty)
            : 0;
    const disputeActionLabel = getDisputeActionButtonLabel(
      item,
      VIEWER_ROLE.BUYER,
      currentTime
    );
    const showHoldingPrimaryActions =
      isHolding &&
      item.status === RESERVATION_STATUS.WAITING_PICKUP &&
      !pastPickup;
    const completedDepositLine =
      isCompletedTab && reservationRequiresDeposit(item)
        ? getCompletedTabDepositLine(item, VIEWER_ROLE.BUYER, currentTime)
        : '';
    const completedDepositPending = isCompletedTabDepositPendingLine(completedDepositLine);

    return (
      <View style={styles.listItemWrap}>
        <View style={styles.card}>
          <View style={styles.cardMainRow}>
          <Pressable
            style={styles.cardMainPress}
            onPress={() =>
              onOpenDetail?.({
                item: normalizeOrderItem(item),
                listCancelReasonText: cancelReasonText,
              })
            }
          >
            <OrderItemHeader
              id={item.id}
              statusLabel={statusLabel}
              statusBadgeStyle={statusStyle.badge}
              statusTextStyle={statusStyle.text}
              orderCodeStyle={useBlackOrderCode ? styles.orderCodeBlack : undefined}
              unitPriceStyle={useBlackUnitPrice ? styles.unitPriceBlack : undefined}
              thumbnail={thumb}
              productName={productName}
              variantName={item.variant?.variantName || ''}
              quantity={qty}
              unitPriceText={formatPrice(unitPrice)}
              lineTotalText={formatPrice(item.totalAmount)}
              priceRowMeta
            >
              {showPickupTimeLine && item.pickupTime ? (
                <Text
                  style={
                    isCompletedTab ? styles.infoLinePickupCompletedList : styles.infoLinePickup
                  }
                >
                  Thời gian nhận: {formatOrderTime(item.pickupTime)}
                </Text>
              ) : showPickupTimeLine ? (
                <Text
                  style={
                    isCompletedTab ? styles.infoLinePickupCompletedList : styles.infoLinePickup
                  }
                >
                  Giữ: {formatOrderTime(item.createdAt)}
                </Text>
              ) : null}
              {item.status === RESERVATION_STATUS.WAITING_PICKUP &&
              pastPickup &&
              !isActiveDisputeOrder(item) &&
              !countdownLine ? (
                <Text style={styles.infoLineDanger}>
                  {isWithinDepositDecisionWindow(item, currentTime)
                    ? `Đã quá giờ nhận. Trong ${getPrePickupDisputeWindowText()} người mua có thể khiếu nại hoặc đồng ý mất cọc.`
                    : `Đã quá ${getPrePickupDisputeWindowText()} sau giờ nhận. Cọc mặc định đã chuyển cho người bán.`}
                </Text>
              ) : null}
              {countdownLine ? (
                <Text style={styles.infoLineCountdown}>{countdownLine}</Text>
              ) : null}
              {completedDepositLine ? (
                <Text
                  style={
                    completedDepositPending
                      ? styles.infoLineCountdown
                      : styles.infoLineDeposit
                  }
                >
                  {completedDepositLine}
                </Text>
              ) : null}
              <OrderDisputeListHints
                item={item}
                viewerRole={VIEWER_ROLE.BUYER}
              />
              {isCancelledTab ? (
                <OrderCancelListHints reasonLine={cancelReasonText} />
              ) : (
                <>
                  {!isActiveDisputeOrder(item) &&
                  !isDisputeResolvedOrder(item) &&
                  cancelReasonText ? (
                    <Text style={styles.infoLineDanger}>{cancelReasonText}</Text>
                  ) : null}
                </>
              )}
            </OrderItemHeader>
          </Pressable>
          {showHoldingPrimaryActions ? (
            <Pressable
              style={styles.itemMoreBtn}
              onPress={() => handleHoldingMoreMenu(item)}
              accessibilityRole="button"
              accessibilityLabel="Hủy đơn hàng"
              hitSlop={8}
            >
              <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
            </Pressable>
          ) : null}
        </View>

        {showHoldingPrimaryActions ? (
          <OrderListActionRow>
            <OrderListActionButton
              label="Đến lấy hàng"
              variant="primary"
              onPress={() => handleNavigatePickup(item)}
            />
            <OrderListActionButton
              label="Mã QR"
              variant="outline"
              onPress={() => handleShowPickupQr(item)}
            />
          </OrderListActionRow>
        ) : canNavigate || canShowPickupQr || canCancel ? (
          <OrderListActionRow>
            {canNavigate ? (
              <OrderListActionButton
                label="🧭 Đến lấy hàng"
                variant="primary"
                onPress={() => handleNavigatePickup(item)}
              />
            ) : null}
            {canShowPickupQr ? (
              <OrderListActionButton
                label="Mã QR"
                variant="outline"
                onPress={() => handleShowPickupQr(item)}
              />
            ) : null}
            {canCancel ? (
              <OrderListActionButton
                label="Hủy đơn"
                variant="dangerOutline"
                onPress={() => handleCancelReservation(item)}
              />
            ) : null}
          </OrderListActionRow>
        ) : null}

        {!showHoldingPrimaryActions &&
        !isDisputeTab &&
        !isDisputeHistoryReadOnly &&
        (canForfeitDeposit || (canReport && !isCompletedTab)) ? (
          <OrderListActionRow>
            {canReport ? (
              <OrderListActionButton
                label="Khiếu nại"
                variant="dangerOutline"
                onPress={() => handleReportShop(item)}
              />
            ) : null}
            {canForfeitDeposit ? (
              <OrderListActionButton
                label="Đồng ý mất cọc"
                variant="outline"
                onPress={() => handleForfeitDeposit(item)}
              />
            ) : null}
          </OrderListActionRow>
        ) : null}

        {showDisputeItemActions ? (
          <OrderListActionRow>
            {canReport ? (
              <OrderListActionButton
                label={disputeActionLabel}
                variant="warning"
                onPress={() => handleReportShop(item)}
              />
            ) : null}
            {canForfeitDeposit ? (
              <OrderListActionButton
                label="Hoàn cọc"
                variant="primary"
                onPress={() => handleForfeitDeposit(item)}
              />
            ) : null}
          </OrderListActionRow>
        ) : null}

        {isCompletedTab && (canReport || canReview) ? (
          <OrderListActionRow>
            {canReport ? (
              <OrderListActionButton
                label="Khiếu nại"
                variant="dangerOutline"
                onPress={() => handleReportShop(item)}
              />
            ) : null}
            {canReview ? (
              <OrderListActionButton
                label="Đánh giá"
                variant="primary"
                onPress={() =>
                  onReviewStore?.({
                    shopId: item.shopId ? String(item.shopId) : '',
                    storeId: item.shopId ? String(item.shopId) : '',
                    storeName,
                    productId: item.product?.id ? String(item.product.id) : '',
                    productName,
                    reservationId: item.id ? String(item.id) : '',
                    orderCode: item.id ? String(item.id) : '',
                  })
                }
              />
            ) : null}
          </OrderListActionRow>
        ) : null}

        {canViewReview ? (
          <OrderListActionRow>
            <OrderListActionButton
              label="Xem đánh giá"
              variant="muted"
              onPress={() => onViewReview?.(existingReview)}
            />
          </OrderListActionRow>
        ) : null}
        </View>
      </View>
    );
  }

  if (isLoading || loadedApiTab !== apiTab) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#076F32" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.contentWrap}>
      <FlatList
        data={visibleItems}
        extraData={currentTime}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
        renderItem={renderReservationItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadOrders({ refresh: true, nextPage: 1 })}
            tintColor="#076F32"
          />
        }
        ListFooterComponent={
          visibleItems.length > 0 ? (
            <LoadMoreButton
              currentCount={visibleItems.length}
              totalCount={
                hasMore ? Math.max(totalCount, items.length + DEFAULT_PAGE_SIZE) : items.length
              }
              loading={isLoadingMore}
              onPress={handleLoadMore}
            />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#076F32" />
          ) : (
            <OrderTabEmptyState
              message={
                isOrderSearchActive(searchInput)
                  ? ORDER_TAB_SEARCH_EMPTY_MESSAGE
                  : activeTab === RESERVATION_TAB.DISPUTE
                    ? DISPUTE_SUB_TAB_EMPTY_MESSAGE[disputeSubTab] ||
                      ORDER_TAB_EMPTY_MESSAGE
                    : activeTab === RESERVATION_TAB.COMPLETED
                      ? COMPLETED_SUB_TAB_EMPTY_MESSAGE[completedSubTab] ||
                        ORDER_TAB_EMPTY_MESSAGE
                      : ORDER_TAB_EMPTY_MESSAGE
              }
            />
          )
        }
      />

      <ReservationDisputeModal
        visible={Boolean(disputeTarget)}
        mode="buyer"
        buyerComplaintKind={
          disputeTarget && isPostDeliveryComplaintContext(disputeTarget)
            ? 'post_delivery'
            : 'pickup'
        }
        onClose={() => setDisputeTarget(null)}
        onSubmit={handleSubmitDispute}
      />
    </View>
  );
}

function resolveInitialTab(tab) {
  if (
    tab === RESERVATION_TAB.ALL ||
    tab === RESERVATION_TAB.PENDING ||
    tab === RESERVATION_TAB.HOLDING ||
    tab === RESERVATION_TAB.DISPUTE ||
    tab === RESERVATION_TAB.COMPLETED ||
    tab === RESERVATION_TAB.CANCELLED
  ) {
    return tab;
  }
  return RESERVATION_TAB.PENDING;
}

export default function BuyerOrdersScreen({
  onOpenStore,
  onNavigatePickup,
  returnDetailRequest = null,
  embedded = true,
  onBack,
  onReviewStore,
  initialTab,
  tabRequestKey = 0,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  isScreenActive = true,
  onNavigationStateChange,
  onOpenBuyerOrders,
  onOpenWalletTopUp,
  resumeReserveRequest = null,
  onResumeReserveHandled,
}) {
  const [internalActiveTab, setInternalActiveTab] = useState(() => resolveInitialTab(initialTab));
  const [disputeSubTab, setDisputeSubTab] = useState(DISPUTE_SUB_TAB.ACTIVE);
  const [completedSubTab, setCompletedSubTab] = useState(COMPLETED_SUB_TAB.ALL);
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const apiTab = resolveOrdersApiTab(activeTab, disputeSubTab, completedSubTab);
  const setActiveTab = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(activeTab) : next;
      if (resolved !== RESERVATION_TAB.DISPUTE) {
        setDisputeSubTab(DISPUTE_SUB_TAB.ACTIVE);
      }
      if (resolved !== RESERVATION_TAB.COMPLETED) {
        setCompletedSubTab(COMPLETED_SUB_TAB.ALL);
      }
      if (controlledActiveTab === undefined) {
        setInternalActiveTab(resolved);
      }
      onActiveTabChange?.(resolved);
    },
    [activeTab, controlledActiveTab, onActiveTabChange]
  );
  const [reviewTarget, setReviewTarget] = useState(null);
  const [viewReviewTarget, setViewReviewTarget] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [detailTarget, setDetailTarget] = useState(null);
  const [detailNestedNav, setDetailNestedNav] = useState(null);
  const [pickupQrTarget, setPickupQrTarget] = useState(null);
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);
  const [orderReviewPatches, setOrderReviewPatches] = useState({});
  const lastTabRequestKeyRef = useRef(0);
  const lastReturnDetailAtRef = useRef(0);
  const wasOrdersActiveRef = useRef(isScreenActive);
  const lastResumeAtRef = useRef(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const { reviewedOrderCodes, reviewsByOrderId, markReviewed, unmarkReviewed } =
    useReviewedOrderCodes(reviewsRefreshKey);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!resumeReserveRequest?.at || !resumeReserveRequest?.productId) {
      return;
    }
    if (lastResumeAtRef.current === resumeReserveRequest.at) {
      return;
    }
    lastResumeAtRef.current = resumeReserveRequest.at;
    setDetailNestedNav({
      screen: 'product',
      productId: String(resumeReserveRequest.productId),
      storeId: resumeReserveRequest.storeId ? String(resumeReserveRequest.storeId) : '',
    });
  }, [resumeReserveRequest?.at, resumeReserveRequest?.productId, resumeReserveRequest?.storeId]);

  useEffect(() => {
    const requestAt = returnDetailRequest?.at || 0;
    if (!returnDetailRequest?.reservationId || requestAt === lastReturnDetailAtRef.current) {
      return;
    }
    lastReturnDetailAtRef.current = requestAt;
    if (returnDetailRequest.tab) {
      setActiveTab(returnDetailRequest.tab);
    }
    setDetailTarget({
      item: { id: String(returnDetailRequest.reservationId) },
      fromTab: returnDetailRequest.tab || activeTab,
    });
  }, [activeTab, returnDetailRequest, setActiveTab]);

  useEffect(() => {
    if (isScreenActive) {
      return;
    }
    setSearchInput('');
    setSearch('');
  }, [isScreenActive]);

  useEffect(() => {
    setOrderReviewPatches({});
  }, [listRefreshKey, activeTab, disputeSubTab, completedSubTab]);

  useEffect(() => {
    onNavigationStateChange?.(Boolean(isScreenActive && (detailTarget || pickupQrTarget)));
  }, [detailTarget, isScreenActive, pickupQrTarget, onNavigationStateChange]);

  useEffect(() => {
    const wasActive = wasOrdersActiveRef.current;
    wasOrdersActiveRef.current = isScreenActive;

    if (!isScreenActive) {
      // Rời bottom tab Đơn hàng → reset UI về "Chờ xác nhận".
      const defaultTab = RESERVATION_TAB.PENDING;
      if (controlledActiveTab === undefined) {
        setInternalActiveTab(defaultTab);
      }
      onActiveTabChange?.(defaultTab);
      setDetailTarget(null);
      setPickupQrTarget(null);
      setReviewTarget(null);
      setViewReviewTarget(null);
      return;
    }

    // Chỉ refresh khi vừa quay lại tab (false → true), không refresh khi đổi tab trạng thái.
    if (!wasActive) {
      setListRefreshKey((value) => value + 1);
    }
  }, [controlledActiveTab, isScreenActive, onActiveTabChange]);

  useEffect(() => {
    if (!tabRequestKey || lastTabRequestKeyRef.current === tabRequestKey) {
      return;
    }

    lastTabRequestKeyRef.current = tabRequestKey;
    const nextTab = resolveInitialTab(initialTab);
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(nextTab);
    }
    onActiveTabChange?.(nextTab);
    setListRefreshKey((value) => value + 1);
  }, [controlledActiveTab, initialTab, onActiveTabChange, tabRequestKey]);

  function renderReviewModals() {
    return (
      <>
        <ShopReviewModal
          visible={Boolean(reviewTarget)}
          storeName={reviewTarget?.storeName}
          productName={reviewTarget?.productName}
          onClose={() => setReviewTarget(null)}
          onSubmit={async ({ rating, comment, images, imageUrl }) => {
            if (!reviewTarget) return;
            try {
              const created = await submitShopReview({
                shopId: reviewTarget.shopId || reviewTarget.storeId,
                productId: reviewTarget.productId,
                reservationId: reviewTarget.reservationId || reviewTarget.orderCode,
                rating,
                comment,
                images,
                imageUrl,
              });
              const reservationKey = String(
                reviewTarget.reservationId || reviewTarget.orderCode || ''
              ).trim();
              const reviewRecord = created
                ? {
                    ...created,
                    id: created.id,
                    reservationId: created.reservationId || reservationKey,
                    orderCode: created.orderCode || reservationKey,
                  }
                : null;
              markReviewed(
                {
                  orderCode: reservationKey,
                  id: reservationKey,
                  reservationId: reservationKey,
                  hasReviewed: true,
                },
                reviewRecord
              );
              if (reviewRecord) {
                setOrderReviewPatches((current) => ({
                  ...current,
                  [reservationKey]: {
                    hasReviewed: true,
                    hasActiveReview: true,
                    buyerReviewId: reviewRecord.id,
                    buyerReview: reviewRecord,
                  },
                }));
              }
              setReviewsRefreshKey((value) => value + 1);
              setReviewTarget(null);
              Alert.alert('Cảm ơn bạn', 'Đánh giá đã được gửi.');
            } catch (error) {
              Alert.alert('Lỗi', error.message || 'Không gửi được đánh giá.');
            }
          }}
        />
        <MyReviewDetailModal
          visible={Boolean(viewReviewTarget)}
          review={viewReviewTarget}
          onClose={() => setViewReviewTarget(null)}
          onDelete={async (review) => {
            try {
              const idToken = await getCurrentUserIdToken();
              const reviewId = String(review?.id || '').trim();
              if (!idToken || !reviewId) {
                throw new Error('Không xác định được đánh giá.');
              }
              await deleteBuyerReviewOnBackend(idToken, reviewId);
              unmarkReviewed({
                id: review?.reservationId || review?.orderCode,
                orderCode: review?.reservationId || review?.orderCode,
                reservationId: review?.reservationId || review?.orderCode,
              });
              const reservationKey = String(review?.reservationId || review?.orderCode || '').trim();
              if (reservationKey) {
                setOrderReviewPatches((current) => {
                  const next = { ...current };
                  delete next[reservationKey];
                  return next;
                });
              }
              setViewReviewTarget(null);
              setReviewsRefreshKey((value) => value + 1);
              setListRefreshKey((value) => value + 1);
              Alert.alert('Đã gỡ', 'Đánh giá đã được gỡ bỏ. Bạn không thể đánh giá lại đơn này.');
            } catch (error) {
              Alert.alert('Lỗi', error.message || 'Không gỡ được đánh giá.');
            }
          }}
        />
      </>
    );
  }

  const tabBar = (
    <>
      <OrderStatusTabBar
        tabs={ORDER_STATUS_TABS}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />
      {activeTab === RESERVATION_TAB.DISPUTE || activeTab === RESERVATION_TAB.COMPLETED ? (
        <View style={styles.subFilterRow}>
          <OrderListSubFilterCombo
            options={
              activeTab === RESERVATION_TAB.DISPUTE ? DISPUTE_SUB_TABS : COMPLETED_SUB_TABS
            }
            value={
              activeTab === RESERVATION_TAB.DISPUTE ? disputeSubTab : completedSubTab
            }
            onChange={(next) => {
              if (activeTab === RESERVATION_TAB.DISPUTE) {
                setDisputeSubTab(next);
                setListRefreshKey((value) => value + 1);
                return;
              }
              setCompletedSubTab(next);
              setListRefreshKey((value) => value + 1);
            }}
          />
        </View>
      ) : null}
    </>
  );

  const body = (
    <>
      <BuyerOrdersContent
        activeTab={activeTab}
        apiTab={apiTab}
        disputeSubTab={disputeSubTab}
        completedSubTab={completedSubTab}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        search={search}
        onNavigatePickup={onNavigatePickup}
        onReviewStore={(target) => {
          setReviewTarget(target);
          onReviewStore?.(target);
        }}
        onViewReview={(review) => {
          const resolved =
            (review?.id && review) ||
            buildViewReviewPayload(review, reviewsByOrderId) ||
            review;
          setViewReviewTarget(resolved);
        }}
        onOpenDetail={(target) =>
          setDetailTarget({
            ...target,
            fromTab: activeTab,
          })
        }
        onOpenShopScan={(item) => setPickupQrTarget(normalizeOrderItem(item))}
        reviewedOrderCodes={reviewedOrderCodes}
        reviewsByOrderId={reviewsByOrderId}
        orderReviewPatches={orderReviewPatches}
        refreshKey={listRefreshKey}
        embedded={embedded}
        isScreenActive={isScreenActive}
      />
      {renderReviewModals()}
    </>
  );

  if (pickupQrTarget) {
    return (
      <View style={styles.screen}>
        <BuyerPickupQrDisplayScreen
          reservation={pickupQrTarget}
          onBack={() => setPickupQrTarget(null)}
          onReservationUpdated={setPickupQrTarget}
        />
      </View>
    );
  }

  function handleReservationOrderSuccess(tab = RESERVATION_TAB.PENDING) {
    setDetailNestedNav(null);
    setDetailTarget(null);
    setActiveTab(tab);
    onOpenBuyerOrders?.(tab);
  }

  if (detailNestedNav?.screen === 'product') {
    return (
      <View style={styles.screen}>
        <ProductDetailScreen
          productId={String(detailNestedNav.productId)}
          onBack={() => {
            if (detailNestedNav.storeId) {
              setDetailNestedNav({
                screen: 'store',
                storeId: String(detailNestedNav.storeId),
              });
              return;
            }
            setDetailNestedNav(null);
          }}
          onStorePress={(storeId) =>
            setDetailNestedNav({
              screen: 'store',
              storeId: String(storeId),
              productId: String(detailNestedNav.productId),
            })
          }
          onOrderSuccess={handleReservationOrderSuccess}
          onOpenTopUp={onOpenWalletTopUp}
          reservationSource="orders"
          reservationStoreId={detailNestedNav.storeId || null}
          resumeReserveRequest={
            resumeReserveRequest &&
            String(resumeReserveRequest.productId) === String(detailNestedNav.productId)
              ? resumeReserveRequest
              : null
          }
          onResumeReserveConsumed={onResumeReserveHandled}
        />
      </View>
    );
  }

  if (detailNestedNav?.screen === 'store') {
    return (
      <View style={styles.screen}>
        <StoreDetailScreen
          storeId={String(detailNestedNav.storeId)}
          onBack={() => setDetailNestedNav(null)}
          onProductPress={(productId) =>
            setDetailNestedNav({
              screen: 'product',
              productId: String(productId),
              storeId: String(detailNestedNav.storeId),
            })
          }
          onOrderSuccess={handleReservationOrderSuccess}
          onOpenTopUp={onOpenWalletTopUp}
          reservationSource="orders"
        />
      </View>
    );
  }

  if (detailTarget) {
    return (
      <View style={styles.screen}>
        <BuyerOrderDetailScreen
          orderId={String(detailTarget.item?.id || '')}
          initialItem={normalizeOrderItem(detailTarget.item)}
          listCancelReasonText={detailTarget.listCancelReasonText || ''}
          onBack={() => {
            if (detailTarget?.fromTab) {
              setActiveTab(detailTarget.fromTab);
            }
            setDetailNestedNav(null);
            setDetailTarget(null);
          }}
          onChanged={() => setListRefreshKey((value) => value + 1)}
          onOpenShop={({ shopId }) => {
            setDetailNestedNav({ screen: 'store', storeId: String(shopId) });
          }}
          onOpenProduct={({ productId, shopId }) => {
            setDetailNestedNav({
              screen: 'product',
              productId: String(productId),
              storeId: shopId ? String(shopId) : '',
            });
          }}
          onOpenShopScan={(item) => {
            setDetailTarget(null);
            setPickupQrTarget(normalizeOrderItem(item || detailTarget.item));
          }}
          onNavigatePickup={(payload) => {
            setDetailTarget(null);
            onNavigatePickup?.(payload);
          }}
          onReviewStore={(target) => {
            setReviewTarget(target);
            onReviewStore?.(target);
          }}
          reviewsByOrderId={reviewsByOrderId}
          reviewedOrderCodes={reviewedOrderCodes}
          onReviewDeleted={(order) => {
            const reservationKey = String(order?.id || detailTarget.item?.id || '').trim();
            if (reservationKey) {
              setOrderReviewPatches((current) => {
                const next = { ...current };
                delete next[reservationKey];
                return next;
              });
              unmarkReviewed({
                id: reservationKey,
                orderCode: reservationKey,
                reservationId: reservationKey,
              });
            }
            setReviewsRefreshKey((value) => value + 1);
            setListRefreshKey((value) => value + 1);
          }}
        />
        {renderReviewModals()}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Đơn hàng" onBack={onBack} />
      <View style={styles.searchRow}>
        <ClearableSearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Tìm mã đơn hoặc tên sản phẩm..."
          style={styles.searchFieldWrap}
        />
      </View>
      {tabBar}
      <View style={styles.body}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleRow: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  body: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#ffffff',
  },
  subFilterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  searchFieldWrap: {
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    minHeight: 46,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexGrow: 1,
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  listItemWrap: {
    marginBottom: 12,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardMainPress: {
    flex: 1,
    minWidth: 0,
  },
  itemMoreBtn: {
    marginLeft: 2,
    marginTop: -2,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  orderCodeBlack: {
    color: '#0f172a',
  },
  unitPriceBlack: {
    color: '#0f172a',
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeTextPending: {
    color: '#b45309',
  },
  statusBadgeSuccess: {
    backgroundColor: '#E6F4EC',
  },
  statusBadgeTextSuccess: {
    color: '#076F32',
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
  infoLineStrong: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  infoLinePickup: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLinePickupCompletedList: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLineMuted: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  infoLineDanger: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLineDeposit: {
    color: '#076F32',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  infoLineCountdown: {
    color: '#ea580c',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionHeading: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.4,
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
    backgroundColor: '#A7D9B8',
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
    backgroundColor: '#076F32',
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
    color: '#076F32',
  },
  progressCancelled: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#b91c1c',
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
});

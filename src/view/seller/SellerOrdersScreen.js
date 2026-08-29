import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOrderListCancelDisplay, getCompletedTabDepositLine, isCompletedTabDepositPendingLine } from '../../core/utils/orderDisplay';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  cancelSellerReservationOnBackend,
  confirmSellerReservationOnBackend,
  getSellerOrdersOnBackend,
  getSellerReservationDetailOnBackend,
  rejectSellerReservationOnBackend,
  reportBuyerNoShowOnBackend,
  refundSellerDisputeDepositOnBackend,
  respondSellerPostDeliveryComplaintOnBackend,
} from '../../api/sellerOpsApi';
import { showErrorAlert } from '../../core/utils/appAlert';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { orderMatchesSearch, isOrderSearchActive } from '../../core/utils/reservationOrderSearch';
import { sortReservationsNewestFirst } from '../../core/utils/reservationOrderSort';
import { reservationRequiresDeposit } from '../../core/utils/reservationEntity';
import { applyReservationRealtimeRow, removeReservationIfLeftTab, syncOrderListAfterMutation } from '../../core/utils/orderRealtimeSync';
import { coalesceReservationFetch } from '../../core/utils/coalesceReservationFetch';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import { hasItemId } from '../../core/utils/realtimeList';
import OrderListActionButton, {
  OrderListActionRow,
} from '../shared/components/OrderListActionButton';
import {
  RESERVATION_TAB,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABELS,
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
  canSellerRefundDisputeDeposit,
  canSellerRefundDepositOnHolding,
  canSellerRespondOnDisputeItem,
  isSellerPostDeliveryResponseAction,
  getDisputeTabListStatusLabel,
  isDisputeHistoryListStatus,
  VIEWER_ROLE,
} from '../../constants/sellerOrders';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import OrderItemHeader from '../shared/components/OrderItemHeader';
import {
  getOrderCountdownLine,
  getDisputeActionButtonLabel,
  getPrePickupDisputeWindowText,
  isWithinDepositDecisionWindowForItem,
} from '../../core/utils/escrowHold';
import { useOrderTimeNow } from '../../hooks/useOrderTimeNow';
import OrderStatusTabBar from '../shared/components/OrderStatusTabBar';
import OrderListSubFilterCombo from '../shared/components/OrderListSubFilterCombo';
import OrderTabEmptyState, {
  ORDER_TAB_EMPTY_MESSAGE,
  ORDER_TAB_SEARCH_EMPTY_MESSAGE,
} from '../shared/components/OrderTabEmptyState';
import OrderDisputeListHints from '../shared/components/OrderDisputeListHints';
import OrderCancelListHints from '../shared/components/OrderCancelListHints';
import ReservationDisputeModal from '../shared/components/ReservationDisputeModal';
import SellerCancelAcceptedModal from '../shared/components/SellerCancelAcceptedModal';
import SubScreenHeader, { APP_HEADER_ICON_BUTTON_STYLE } from '../shared/components/SubScreenHeader';
import { formatPrice } from '../../core/utils/productFormat';
import { getOrderCodeValue } from '../../core/utils/orderCode';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useOrderSocket } from '../../hooks/useOrderSocket';

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

function isPastPickup(item, now) {
  if (!item?.pickupTime) return false;
  const pickup = new Date(item.pickupTime);
  return Number.isFinite(pickup.getTime()) && now >= pickup.getTime();
}

function canReportBuyerNoShow(item, now) {
  return (
    item.canReportBuyer === true ||
    ((item.status === RESERVATION_STATUS.WAITING_PICKUP ||
      item.status === RESERVATION_STATUS.DISPUTED) &&
      isPastPickup(item, now) &&
      !item.disputeBySeller)
  );
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

export default function SellerOrdersScreen({
  onBack,
  onOpenReservation,
  onScanPickupQr,
  onShowShopQr,
  onRefreshKey = 0,
  embedded = false,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  isScreenActive = true,
  accountLockedOrderMode = false,
}) {
  const insets = useScreenInsets();
  const [internalActiveTab, setInternalActiveTab] = useState(RESERVATION_TAB.PENDING);
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
  const [items, setItems] = useState([]);
  // Đọc danh sách hiện tại trong handler realtime mà không cần thêm dependency.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedApiTab, setLoadedApiTab] = useState(apiTab);
  const ordersFetchSeqRef = useRef(0);
  const loadingMoreGuardRef = useRef(false);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [responseTarget, setResponseTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const pickupScheduleItems = useMemo(() => {
    if (activeTab !== RESERVATION_TAB.HOLDING) {
      return [];
    }
    return items.filter((row) => row.status === RESERVATION_STATUS.WAITING_PICKUP);
  }, [activeTab, items]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadOrders = useCallback(async ({ nextPage = 1, silent = false } = {}) => {
    const fetchSeq = ++ordersFetchSeqRef.current;

    if (nextPage > 1) {
      if (loadingMoreGuardRef.current) {
        return;
      }
      loadingMoreGuardRef.current = true;
    }

    if (nextPage === 1) {
      if (!silent) {
        setIsLoading(true);
      }
    } else {
      setIsLoadingMore(true);
    }
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerOrdersOnBackend({
        idToken,
        tab: apiTab,
        search: debouncedSearch || undefined,
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      if (fetchSeq !== ordersFetchSeqRef.current) {
        return;
      }
      const rows = data?.reservations || data?.items || [];
      setItems((current) => {
        if (nextPage === 1) {
          return rows;
        }
        return appendUniqueById(current, rows);
      });
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
      const message = loadError.message || 'Không tải được đơn hàng.';
      showErrorAlert(message, 'Lỗi', { accountLockedOrderMode });
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
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [accountLockedOrderMode, apiTab, debouncedSearch]);

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
    setSearch('');
    setDebouncedSearch('');
  }, [activeTab]);

  useEffect(() => {
    ordersFetchSeqRef.current += 1;
    loadingMoreGuardRef.current = false;
    setItems([]);
    setPage(1);
    setHasMore(true);
    setTotalCount(0);
    setIsLoading(true);
  }, [apiTab]);

  useEffect(() => {
    loadOrders({ nextPage: 1 });
  }, [loadOrders]);

  const prevRefreshKeyRef = useRef(onRefreshKey);
  useEffect(() => {
    if (prevRefreshKeyRef.current === onRefreshKey) {
      return;
    }
    prevRefreshKeyRef.current = onRefreshKey;
    if (onRefreshKey > 0) {
      loadOrders({ nextPage: 1, silent: true });
    }
  }, [onRefreshKey, loadOrders]);

  const syncListAfterMutation = useCallback(
    (reservation, reservationId) => {
      syncOrderListAfterMutation({
        reservation,
        reservationId,
        activeTab,
        disputeSubTab: activeTab === RESERVATION_TAB.DISPUTE ? disputeSubTab : null,
        completedSubTab: activeTab === RESERVATION_TAB.COMPLETED ? completedSubTab : null,
        search: debouncedSearch,
        itemsRef,
        setItems,
        setTotalCount,
        loadOrders,
      });
    },
    [activeTab, disputeSubTab, completedSubTab, debouncedSearch, loadOrders]
  );

  /**
   * Realtime: chỉ đồng bộ đúng đơn vừa thay đổi (không tải lại cả danh sách).
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
      const hasSearch = String(debouncedSearch || '').trim().length > 0;

      if (!isInList && (!belongsToTab || hasSearch)) {
        return;
      }

      try {
        const reservation = await coalesceReservationFetch('seller', reservationId, async () => {
          const idToken = await getCurrentUserIdToken();
          if (!idToken) {
            return null;
          }
          return getSellerReservationDetailOnBackend(idToken, reservationId);
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
          search: debouncedSearch,
          currentItems: itemsRef.current,
          setItems,
          setTotalCount,
        });
      } catch {
        // Giữ danh sách hiện tại nếu tải lỗi.
      }
    },
    [activeTab, disputeSubTab, completedSubTab, debouncedSearch]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore || loadingMoreGuardRef.current) {
      return;
    }
    loadOrders({ nextPage: page + 1 });
  }, [hasMore, isLoading, isLoadingMore, loadOrders, page]);

  useOrderSocket({
    enabled: isScreenActive,
    onOrderUpdated: handleOrderUpdated,
  });

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeTab === RESERVATION_TAB.HOLDING) {
      list = list.filter((item) => !isCancelledReservationStatus(item.status));
    }
    if (isOrderSearchActive(search)) {
      list = list.filter((item) => orderMatchesSearch(item, search, 'seller'));
    }
    return sortReservationsNewestFirst(list, activeTab);
  }, [items, activeTab, search]);

  function handleConfirmReservation(reservation) {
    const depositNote =
      Number(reservation.depositAmount) > 0
        ? `\n\nSau khi xác nhận, đưa QR gian hàng cho khách quét khi nhận hàng. Khi đó bạn nhận cọc ${formatPrice(reservation.depositAmount)}.`
        : '\n\nSau khi xác nhận, đưa QR gian hàng cho khách quét khi nhận hàng để hoàn tất.';
    Alert.alert('Xác nhận giữ hàng', `Bạn xác nhận giữ hàng cho khách này?${depositNote}`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            const updated = await confirmSellerReservationOnBackend(idToken, reservation.id);
            syncListAfterMutation(updated, reservation.id);
          } catch (actionError) {
            showErrorAlert(actionError.message || 'Không xác nhận được đơn.', 'Lỗi', {
              accountLockedOrderMode,
            });
          }
        },
      },
    ]);
  }

  function handleRejectReservation(reservation) {
    Alert.alert('Từ chối giữ hàng', 'Bạn chắc chắn từ chối yêu cầu giữ hàng này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            const updated = await rejectSellerReservationOnBackend({
              idToken,
              reservationId: reservation.id,
              reason: 'Shop hủy',
            });
            syncListAfterMutation(updated, reservation.id);
          } catch (actionError) {
            showErrorAlert(actionError.message || 'Không từ chối được đơn.', 'Lỗi', {
              accountLockedOrderMode,
            });
          }
        },
      },
    ]);
  }

  async function handleSubmitBuyerNoShow(payload) {
    if (!disputeTarget) {
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      const reservationId = disputeTarget.id;
      const updated = await reportBuyerNoShowOnBackend({
        idToken,
        reservationId,
        reason: payload.reason,
        title: payload.title,
        description: payload.description,
        note: payload.note,
        images: payload.images,
      });
      setDisputeTarget(null);
      syncListAfterMutation(updated?.reservation || updated, reservationId);
      Alert.alert('Đã gửi', 'Phản hồi đã được gửi.');
    } catch (actionError) {
      showErrorAlert(actionError.message || 'Không gửi được phản hồi.', 'Lỗi', {
        accountLockedOrderMode,
      });
    }
  }

  async function handleSubmitDisputeResponse(payload) {
    if (!responseTarget) {
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      const reservationId = responseTarget.id;
      const updated = await respondSellerPostDeliveryComplaintOnBackend(idToken, {
        reservationId,
        description: payload.description,
        images: payload.images,
      });
      setResponseTarget(null);
      syncListAfterMutation(updated, reservationId);
      Alert.alert('Đã gửi', 'Phản hồi đã được gửi. Admin sẽ xử lý tranh chấp.');
    } catch (actionError) {
      showErrorAlert(actionError.message || 'Không gửi được phản hồi.', 'Lỗi', {
        accountLockedOrderMode,
      });
    }
  }

  function handleOpenDisputeRespond(item) {
    if (isSellerPostDeliveryResponseAction(item)) {
      setResponseTarget(item);
      return;
    }
    setDisputeTarget(item);
  }

  async function handleSubmitCancelAccepted(payload) {
    if (!cancelTarget) {
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      const reservationId = cancelTarget.id;
      const updated = await cancelSellerReservationOnBackend({
        idToken,
        reservationId,
        reason: payload.reason,
        images: payload.images,
      });
      setCancelTarget(null);
      syncListAfterMutation(updated, reservationId);
    } catch (actionError) {
      showErrorAlert(actionError.message || 'Không hủy được đơn.', 'Lỗi', {
        accountLockedOrderMode,
      });
      throw actionError;
    }
  }

  function handleRefundDeposit(item) {
    const isDispute = Number(item.status) === RESERVATION_STATUS.DISPUTED;
    Alert.alert(
      'Hoàn cọc cho người mua?',
      isDispute
        ? 'Tiền cọc sẽ được hoàn về ví người mua và đơn sẽ kết thúc tranh chấp.'
        : 'Tiền cọc sẽ được hoàn về ví người mua và đơn sẽ được hủy.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Hoàn cọc',
          onPress: async () => {
            try {
              const idToken = await getCurrentUserIdToken();
              const updated = await refundSellerDisputeDepositOnBackend(idToken, item.id);
              syncListAfterMutation(updated, item.id);
              Alert.alert('Đã hoàn cọc', 'Tiền cọc đã được hoàn cho người mua.');
            } catch (actionError) {
              showErrorAlert(actionError.message || 'Không hoàn cọc được.', 'Lỗi', {
                accountLockedOrderMode,
              });
            }
          },
        },
      ]
    );
  }

  function renderReservationItem({ item }) {
    const isCompletedTab = activeTab === RESERVATION_TAB.COMPLETED;
    const isCancelledTab = activeTab === RESERVATION_TAB.CANCELLED;
    const isDisputeTab = activeTab === RESERVATION_TAB.DISPUTE;
    const statusLabel = isDisputeTab
      ? getDisputeTabListStatusLabel(item, disputeSubTab)
      : isCompletedTab
        ? getSellerCompletedOrderStatusLabel(item.status)
        : RESERVATION_STATUS_LABELS[item.status] || 'Không rõ';
    const statusStyle =
      isDisputeTab && isDisputeHistoryListStatus(item, disputeSubTab)
        ? { badge: styles.statusBadgeSuccess, text: styles.statusBadgeTextSuccess }
        : getReservationStatusStyle(item.status);
    const productName = item.product?.productName || 'Sản phẩm';
    const thumb = item.product?.thumbnail || '';
    const qty = Number(item.quantity) || 0;
    const canConfirm = item.status === RESERVATION_STATUS.PENDING_SELLER_CONFIRMATION;
    const pastPickup = isPastPickup(item, currentTime);
    const useBlackOrderCode =
      canConfirm ||
      activeTab === RESERVATION_TAB.HOLDING ||
      activeTab === RESERVATION_TAB.COMPLETED ||
      activeTab === RESERVATION_TAB.CANCELLED;
    const useBlackUnitPrice =
      canConfirm || activeTab === RESERVATION_TAB.HOLDING;
    const showActiveDisputeHint = isActiveDisputeOrder(item);
    const isDisputeHistoryReadOnly = isDisputeHistoryReadOnlyOrder(item);
    const canReportBuyer =
      !isDisputeHistoryReadOnly && canReportBuyerNoShow(item, currentTime);
    const canRefundDeposit =
      !isDisputeHistoryReadOnly &&
      pastPickup &&
      activeTab === RESERVATION_TAB.HOLDING &&
      !showActiveDisputeHint &&
      canSellerRefundDepositOnHolding(item);
    const canCancelBeforePickup =
      !pastPickup &&
      activeTab === RESERVATION_TAB.HOLDING &&
      item.status === RESERVATION_STATUS.WAITING_PICKUP &&
      !showActiveDisputeHint &&
      canSellerRefundDepositOnHolding(item);
    const canRefundDisputeDeposit = canSellerRefundDisputeDeposit(item);
    const canRespondDispute = canSellerRespondOnDisputeItem(item);
    const showDisputeItemActions =
      isDisputeTab &&
      disputeSubTab === DISPUTE_SUB_TAB.ACTIVE &&
      isActiveDisputeOrder(item) &&
      (canRespondDispute || canRefundDisputeDeposit);
    const showPastPickupItemActions =
      activeTab === RESERVATION_TAB.HOLDING &&
      item.status === RESERVATION_STATUS.WAITING_PICKUP &&
      pastPickup &&
      !showActiveDisputeHint &&
      (canRefundDeposit || canReportBuyer);
    const showHoldingPrimaryActions =
      activeTab === RESERVATION_TAB.HOLDING &&
      item.status === RESERVATION_STATUS.WAITING_PICKUP &&
      !pastPickup &&
      !showActiveDisputeHint &&
      (onScanPickupQr || onShowShopQr);
    const showPickupTimeLine = !isDisputeTab && !isCompletedTab && !isCancelledTab;
    const cancelDisplay = getOrderListCancelDisplay(item, VIEWER_ROLE.SELLER);
    const cancelReasonText = cancelDisplay.reasonLine;
    const countdownLine =
      isCompletedTab || isActiveDisputeOrder(item)
        ? ''
        : getOrderCountdownLine(item, currentTime, VIEWER_ROLE.SELLER);
    const escrowHoldLabel =
      isCompletedTab && reservationRequiresDeposit(item)
        ? getCompletedTabDepositLine(item, VIEWER_ROLE.SELLER, currentTime)
        : '';
    const escrowHoldPending = isCompletedTabDepositPendingLine(escrowHoldLabel);
    const disputeActionLabel = getDisputeActionButtonLabel(
      item,
      VIEWER_ROLE.SELLER,
      currentTime
    );
    const unitPrice =
      item.agreedPrice != null
        ? Number(item.agreedPrice)
        : item.variant?.price != null
          ? Number(item.variant.price)
          : qty > 0
            ? Math.round(Number(item.totalAmount || 0) / qty)
            : 0;

    return (
      <View style={styles.card}>
        <Pressable
          onPress={() =>
            onOpenReservation?.({
              item,
              listCancelReasonText: cancelReasonText,
              fromTab: activeTab,
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
              <Text style={styles.infoLinePickup}>
                Thời gian nhận: {formatOrderTime(item.pickupTime)}
              </Text>
            ) : showPickupTimeLine ? (
              <Text style={styles.infoLinePickup}>Giữ: {formatOrderTime(item.createdAt)}</Text>
            ) : null}
            {escrowHoldLabel ? (
              <Text
                style={
                  escrowHoldPending ? styles.infoLineEscrowCountdown : styles.infoLineDeposit
                }
              >
                {escrowHoldLabel}
              </Text>
            ) : null}
            {countdownLine ? (
              <Text style={styles.infoLineCountdown}>{countdownLine}</Text>
            ) : null}
            {item.status === RESERVATION_STATUS.WAITING_PICKUP &&
            pastPickup &&
            !showActiveDisputeHint &&
            !countdownLine &&
            reservationRequiresDeposit(item) ? (
              <Text style={styles.infoLineDanger}>
                {isWithinDepositDecisionWindow(item, currentTime)
                  ? `Đã quá giờ nhận. Trong ${getPrePickupDisputeWindowText()} người bán có thể khiếu nại hoặc hoàn cọc cho người mua.`
                  : `Đã quá ${getPrePickupDisputeWindowText()} sau giờ nhận. Cọc mặc định đã chuyển cho người bán.`}
              </Text>
            ) : null}
            <OrderDisputeListHints
              item={item}
              viewerRole={VIEWER_ROLE.SELLER}
            />
            {isCancelledTab ? (
              <OrderCancelListHints reasonLine={cancelReasonText} />
            ) : (
              <>
                {!showActiveDisputeHint && !isDisputeResolvedOrder(item) && cancelReasonText ? (
                  <Text style={styles.infoLineDanger}>{cancelReasonText}</Text>
                ) : null}
              </>
            )}
          </OrderItemHeader>
        </Pressable>

        {canConfirm ? (
          <OrderListActionRow>
            <OrderListActionButton
              label="Từ chối"
              variant="dangerOutline"
              onPress={() => handleRejectReservation(item)}
            />
            <OrderListActionButton
              label="Đồng ý"
              variant="primary"
              onPress={() => handleConfirmReservation(item)}
            />
          </OrderListActionRow>
        ) : null}

        {showDisputeItemActions ? (
          <OrderListActionRow>
            {canRespondDispute ? (
              <OrderListActionButton
                label="Phản hồi"
                variant="warning"
                onPress={() => handleOpenDisputeRespond(item)}
              />
            ) : null}
            {canRefundDisputeDeposit ? (
              <OrderListActionButton
                label="Hoàn cọc"
                variant="primary"
                onPress={() => handleRefundDeposit(item)}
              />
            ) : null}
          </OrderListActionRow>
        ) : showPastPickupItemActions ? (
          <OrderListActionRow>
            {canReportBuyer ? (
              <OrderListActionButton
                label={disputeActionLabel}
                variant="warning"
                onPress={() => setDisputeTarget(item)}
              />
            ) : null}
            {canRefundDeposit ? (
              <OrderListActionButton
                label="Hoàn cọc"
                variant="primary"
                onPress={() => handleRefundDeposit(item)}
              />
            ) : null}
          </OrderListActionRow>
        ) : canCancelBeforePickup ? (
          <OrderListActionRow>
            <OrderListActionButton
              label="Hủy đơn"
              variant="dangerOutline"
              onPress={() => setCancelTarget(item)}
            />
          </OrderListActionRow>
        ) : showHoldingPrimaryActions ? (
          <OrderListActionRow>
            {onScanPickupQr ? (
              <OrderListActionButton
                label="Đến nhận hàng"
                variant="primary"
                onPress={onScanPickupQr}
              />
            ) : null}
            {onShowShopQr ? (
              <OrderListActionButton
                label="Mã QR gian hàng"
                variant="outline"
                onPress={onShowShopQr}
              />
            ) : null}
          </OrderListActionRow>
        ) : null}
      </View>
    );
  }

  const isListStale = loadedApiTab !== apiTab;
  const showListLoading = isLoading || isListStale;

  return (
    <View style={styles.screen}>
      <SubScreenHeader
        title="Đơn hàng"
        onBack={onBack}
        rightSlot={
          onScanPickupQr ? (
            <Pressable
              style={APP_HEADER_ICON_BUTTON_STYLE}
              onPress={onScanPickupQr}
              accessibilityRole="button"
              accessibilityLabel="Quét QR giao hàng"
              hitSlop={8}
            >
              <Ionicons name="scan-outline" size={18} color="#076F32" />
            </Pressable>
          ) : null
        }
      />

      <View style={styles.searchBar}>
        <ClearableSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm mã đơn hoặc tên sản phẩm..."
        />
      </View>

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
                return;
              }
              setCompletedSubTab(next);
            }}
          />
        </View>
      ) : null}

      {showListLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          extraData={currentTime}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.nestedScrollPaddingBottom },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={renderReservationItem}
          ListFooterComponent={
            filteredItems.length > 0 ? (
              <LoadMoreButton
                currentCount={filteredItems.length}
                totalCount={
                  isOrderSearchActive(search)
                    ? filteredItems.length
                    : hasMore
                      ? Math.max(totalCount, items.length + DEFAULT_PAGE_SIZE)
                      : items.length
                }
                loading={isLoadingMore}
                onPress={handleLoadMore}
              />
            ) : null
          }
          ListEmptyComponent={
            <OrderTabEmptyState
              message={
                isOrderSearchActive(search)
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
          }
        />
      )}

      <ReservationDisputeModal
        visible={Boolean(disputeTarget)}
        mode="seller"
        onClose={() => setDisputeTarget(null)}
        onSubmit={handleSubmitBuyerNoShow}
      />
      <ReservationDisputeModal
        visible={Boolean(responseTarget)}
        mode="seller_response"
        onClose={() => setResponseTarget(null)}
        onSubmit={handleSubmitDisputeResponse}
      />
      <SellerCancelAcceptedModal
        visible={Boolean(cancelTarget)}
        orderCode={cancelTarget ? getOrderCodeValue(cancelTarget.id) : ''}
        onClose={() => setCancelTarget(null)}
        onSubmit={handleSubmitCancelAccepted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  listContent: { padding: 16, flexGrow: 1 },
  searchBar: {
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
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
    marginTop: 4,
  },
  infoLineDeposit: {
    color: '#055528',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  infoLineEscrowCountdown: {
    color: '#ea580c',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLineCountdown: {
    color: '#ea580c',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLinePickup: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLineMuted: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
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
  sectionHeading: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  centered: { alignItems: 'center', paddingVertical: 40 },
  errorText: {
    color: '#b91c1c',
    paddingHorizontal: 16,
    paddingTop: 8,
    fontWeight: '700',
  },
});

import { useCallback, useEffect, useState } from 'react';
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

import CircularBackButton from '../shared/components/CircularBackButton';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import {
  cancelBuyerReservationOnBackend,
  getBuyerOrdersOnBackend,
} from '../../api/buyerOpsApi';
import { RESERVATION_TAB, RESERVATION_STATUS } from '../../constants/sellerOrders';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { formatPrice } from '../../core/utils/productFormat';
import { submitShopReview } from '../../core/utils/orderReview';
import { useReviewedOrderCodes } from '../../hooks/useReviewedOrderCodes';
import ShopReviewModal from '../shared/components/ShopReviewModal';
import OrderItemHeader from '../shared/components/OrderItemHeader';
import BuyerOrderDetailScreen from './BuyerOrderDetailScreen';

const TABS = [
  { key: RESERVATION_TAB.HOLDING, label: 'Giữ hàng' },
  { key: RESERVATION_TAB.COMPLETED, label: 'Hoàn thành' },
  { key: RESERVATION_TAB.CANCELLED, label: 'Đã hủy' },
];

const RESERVATION_STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING]: 'Chờ xác nhận',
  [RESERVATION_STATUS.CONFIRMED]: 'Đã xác nhận',
  [RESERVATION_STATUS.COMPLETED]: 'Hoàn thành',
  [RESERVATION_STATUS.CANCELLED]: 'Đã hủy',
};

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
  onNavigatePickup,
  onReviewStore,
  onOpenDetail,
  reviewedOrderCodes,
  refreshKey = 0,
}) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
      setItems(data.reservations || []);
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

  function handleNavigatePickup(item) {
    onNavigatePickup?.({
      shopId: item.shopId,
      reservationId: String(item.id),
      storeName: item.storeName,
    });
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

  function renderReservationItem({ item }) {
    const isHolding = activeTab === RESERVATION_TAB.HOLDING;
    const statusLabel = RESERVATION_STATUS_LABELS[item.status] || 'Không rõ';
    const statusStyle = getReservationStatusStyle(item.status);
    const canCancel =
      isHolding && item.status === RESERVATION_STATUS.PENDING && !item.buyerCancelLocked;
    const canReview =
      activeTab === RESERVATION_TAB.COMPLETED &&
      !reviewedOrderCodes?.has(String(item.id));
    const canNavigate = isHolding && item.status === RESERVATION_STATUS.CONFIRMED;
    const storeName = pickStoreName(item.storeName, item.shopUsername, item.shop?.shopName);
    const productName = item.product?.productName || 'Sản phẩm';
    const thumb = item.product?.thumbnail || '';
    const qty = Number(item.quantity) || 0;

    return (
      <View style={styles.card}>
        <Pressable
          onPress={() => onOpenDetail?.({ item: normalizeOrderItem(item) })}
        >
          <OrderItemHeader
            id={item.id}
            statusLabel={statusLabel}
            statusBadgeStyle={statusStyle.badge}
            statusTextStyle={statusStyle.text}
            thumbnail={thumb}
            productName={productName}
            variantName={item.variant?.variantName || ''}
            quantity={qty}
            unitPriceText={formatPrice(
              item.agreedPrice != null
                ? Number(item.agreedPrice)
                : qty > 0
                  ? Math.round(Number(item.totalAmount || 0) / qty)
                  : 0
            )}
            partyLine={storeName ? `Gian hàng: ${storeName}` : ''}
          >
            <Text style={styles.infoLineStrong}>
              Tổng tiền: {formatPrice(item.totalAmount)}
            </Text>
            {item.pickupTime ? (
              <Text style={styles.infoLineMuted}>
                Giờ lấy: {formatOrderTime(item.pickupTime)}
              </Text>
            ) : (
              <Text style={styles.infoLineMuted}>Giữ: {formatOrderTime(item.createdAt)}</Text>
            )}
            {item.status === RESERVATION_STATUS.CANCELLED && item.cancelReason ? (
              <Text style={styles.infoLineDanger}>Lý do: {item.cancelReason}</Text>
            ) : null}
          </OrderItemHeader>
        </Pressable>

        {isHolding || activeTab === RESERVATION_TAB.COMPLETED ? (
          <ReservationProgress status={item.status} />
        ) : null}

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
                  productName,
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
        <ActivityIndicator color="#076F32" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.contentWrap}>
      <View style={styles.searchRow}>
        <ClearableSearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Tìm sản phẩm, cửa hàng..."
          style={styles.searchField}
        />
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
        renderItem={renderReservationItem}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadOrders(true)} tintColor="#076F32" />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Chưa có đơn trong mục này</Text>
            <Text style={styles.emptyText}>Đơn giữ hàng sẽ hiển thị tại đây.</Text>
          </View>
        }
      />
    </View>
  );
}

function resolveInitialTab(tab) {
  if (tab === RESERVATION_TAB.HOLDING || tab === RESERVATION_TAB.COMPLETED || tab === RESERVATION_TAB.CANCELLED) {
    return tab;
  }
  return RESERVATION_TAB.HOLDING;
}

export default function BuyerOrdersScreen({
  onOpenStore,
  onNavigatePickup,
  embedded = true,
  onBack,
  onReviewStore,
  initialTab,
  tabRequestKey = 0,
  onNavigationStateChange,
}) {
  const [activeTab, setActiveTab] = useState(() => resolveInitialTab(initialTab));
  const [reviewTarget, setReviewTarget] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [detailTarget, setDetailTarget] = useState(null);
  const { reviewedOrderCodes, markReviewed } = useReviewedOrderCodes();

  useEffect(() => {
    onNavigationStateChange?.(Boolean(detailTarget));
  }, [detailTarget, onNavigationStateChange]);

  useEffect(() => {
    if (!initialTab) {
      return;
    }
    const nextTab = resolveInitialTab(initialTab);
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [initialTab, tabRequestKey]);

  useEffect(() => {
    if (!tabRequestKey) {
      return;
    }
    setListRefreshKey((value) => value + 1);
  }, [tabRequestKey]);

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

  const body = (
    <>
      <BuyerOrdersContent
        activeTab={activeTab}
        onNavigatePickup={onNavigatePickup}
        onReviewStore={(target) => {
          setReviewTarget(target);
          onReviewStore?.(target);
        }}
        onOpenDetail={setDetailTarget}
        reviewedOrderCodes={reviewedOrderCodes}
        refreshKey={listRefreshKey}
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
          orderId={String(detailTarget.item?.id || '')}
          initialItem={normalizeOrderItem(detailTarget.item)}
          onBack={() => setDetailTarget(null)}
          onChanged={() => setListRefreshKey((value) => value + 1)}
          onNavigatePickup={(payload) => {
            setDetailTarget(null);
            onNavigatePickup?.(payload);
          }}
          onReviewStore={(target) => {
            setDetailTarget(null);
            setReviewTarget(target);
            onReviewStore?.(target);
          }}
          canReview={
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
        <View style={styles.header}>
          {onBack ? (
            <View style={styles.headerRow}>
              <CircularBackButton onPress={onBack} variant="plain" />
              <Text style={styles.title}>Đơn hàng</Text>
            </View>
          ) : (
            <Text style={styles.title}>Đơn hàng</Text>
          )}
        </View>
        {tabBar}
        <View style={styles.body}>{body}</View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <CircularBackButton onPress={onBack} variant="plain" />
          <Text style={styles.title}>Lịch sử giữ hàng</Text>
        </View>
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
    borderColor: '#076F32',
    backgroundColor: '#E6F4EC',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#076F32',
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
    alignItems: 'center',
  },
  searchField: {
    flex: 1,
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
  infoLineMuted: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  infoLineDanger: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
    backgroundColor: '#076F32',
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
    color: '#076F32',
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
});

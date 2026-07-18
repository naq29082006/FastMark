import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  confirmSellerReservationOnBackend,
  getSellerOrdersOnBackend,
  rejectSellerReservationOnBackend,
} from '../../api/sellerOpsApi';
import {
  RESERVATION_TAB,
  RESERVATION_STATUS,
} from '../../constants/sellerOrders';
import CircularBackButton from '../shared/components/CircularBackButton';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import OrderItemHeader from '../shared/components/OrderItemHeader';
import { formatPrice } from '../../core/utils/productFormat';

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

export default function SellerOrdersScreen({
  onBack,
  onOpenReservation,
  onRefreshKey = 0,
  embedded = false,
}) {
  const [activeTab, setActiveTab] = useState(RESERVATION_TAB.HOLDING);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerOrdersOnBackend({ idToken, tab: activeTab });
      setItems(data.reservations || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được đơn hàng.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setSearch('');
    loadOrders();
  }, [loadOrders, onRefreshKey]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return items;
    }
    return items.filter((item) => {
      const productName = String(
        item.product?.productName || item.productName || ''
      ).toLowerCase();
      const variantName = String(
        item.variant?.variantName || item.variantName || ''
      ).toLowerCase();
      const buyerName = String(
        item.buyer?.fullName || item.buyer?.name || item.buyerName || ''
      ).toLowerCase();
      const id = String(item.id || item.orderCode || '').toLowerCase();
      const note = String(item.note || '').toLowerCase();
      return (
        productName.includes(keyword) ||
        variantName.includes(keyword) ||
        buyerName.includes(keyword) ||
        id.includes(keyword) ||
        note.includes(keyword)
      );
    });
  }, [items, search]);

  function handleConfirmReservation(reservation) {
    Alert.alert('Xác nhận giữ hàng', 'Bạn xác nhận giữ hàng cho khách này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            await confirmSellerReservationOnBackend(idToken, reservation.id);
            Alert.alert('Thành công', 'Đã xác nhận giữ hàng.');
            loadOrders();
          } catch (actionError) {
            Alert.alert('Lỗi', actionError.message || 'Không xác nhận được đơn.');
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
            await rejectSellerReservationOnBackend({
              idToken,
              reservationId: reservation.id,
              reason: 'Shop hủy',
            });
            loadOrders();
          } catch (actionError) {
            Alert.alert('Lỗi', actionError.message || 'Không từ chối được đơn.');
          }
        },
      },
    ]);
  }

  function renderReservationItem({ item }) {
    const statusLabel = RESERVATION_STATUS_LABELS[item.status] || 'Không rõ';
    const statusStyle = getReservationStatusStyle(item.status);
    const productName = item.product?.productName || 'Sản phẩm';
    const thumb = item.product?.thumbnail || '';
    const qty = Number(item.quantity) || 0;
    const buyerName = item.buyer?.fullName || 'Khách';
    const canConfirm = item.status === RESERVATION_STATUS.PENDING;
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
        <Pressable onPress={() => onOpenReservation?.(item.id)}>
          <OrderItemHeader
            id={item.id}
            statusLabel={statusLabel}
            statusBadgeStyle={statusStyle.badge}
            statusTextStyle={statusStyle.text}
            thumbnail={thumb}
            productName={productName}
            variantName={item.variant?.variantName || ''}
            quantity={qty}
            unitPriceText={formatPrice(unitPrice)}
            partyLine={`Khách: ${buyerName}`}
          >
            <Text style={styles.infoLineStrong}>
              Tổng tiền: {formatPrice(item.totalAmount)}
            </Text>
            {Number(item.depositAmount) > 0 ? (
              <Text style={styles.infoLineDeposit}>
                Đã cọc {formatPrice(item.depositAmount)}
                {item.depositPaidAt ? '' : ' (chưa trừ ví)'}
              </Text>
            ) : null}
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

        {canConfirm ? (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, styles.actionButtonFlex]}
              onPress={() => handleConfirmReservation(item)}
            >
              <Text style={styles.actionButtonText}>Xác nhận</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.actionButtonDanger, styles.actionButtonFlex]}
              onPress={() => handleRejectReservation(item)}
            >
              <Text style={styles.actionButtonTextDanger}>Từ chối</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {embedded ? (
          <Text style={styles.title}>Đơn hàng</Text>
        ) : (
          <View style={styles.headerRow}>
            <CircularBackButton onPress={onBack} variant="plain" />
            <Text style={styles.title}>Đơn hàng</Text>
          </View>
        )}
      </View>

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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.searchBar}>
        <ClearableSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo sản phẩm, khách, mã đơn..."
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={renderReservationItem}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {search.trim() ? 'Không tìm thấy đơn phù hợp.' : 'Chưa có đơn trong mục này.'}
              </Text>
            </View>
          }
        />
      )}
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
  listContent: { padding: 16, paddingBottom: 32 },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#f1f5f9',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
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
  infoLineDeposit: {
    color: '#055528',
    fontSize: 12,
    fontWeight: '700',
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  actionButtonFlex: {
    flexGrow: 1,
    flexBasis: '30%',
  },
  actionButtonDanger: {
    backgroundColor: '#fee2e2',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  actionButtonTextDanger: {
    color: '#b91c1c',
    fontWeight: '800',
    fontSize: 13,
  },
  centered: { alignItems: 'center', paddingVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#64748b', fontWeight: '600' },
  errorText: {
    color: '#b91c1c',
    paddingHorizontal: 16,
    paddingTop: 8,
    fontWeight: '700',
  },
});

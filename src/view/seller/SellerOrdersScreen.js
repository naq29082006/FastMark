import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  acceptSellerDealOnBackend,
  confirmSellerReservationOnBackend,
  counterSellerDealOnBackend,
  getSellerOrdersOnBackend,
  rejectSellerDealOnBackend,
  rejectSellerReservationOnBackend,
} from '../../api/sellerOpsApi';
import {
  RESERVATION_TAB,
  RESERVATION_STATUS,
  DEAL_OFFER_BY,
  DEAL_OFFER_STATUS,
} from '../../constants/sellerOrders';
import CircularBackButton from '../shared/components/CircularBackButton';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import OrderItemHeader from '../shared/components/OrderItemHeader';
import { formatPrice } from '../../core/utils/productFormat';

const TABS = [
  { key: RESERVATION_TAB.PENDING_PRICE, label: 'Deal giá' },
  { key: RESERVATION_TAB.HOLDING, label: 'Giữ hàng' },
  { key: RESERVATION_TAB.COMPLETED, label: 'Hoàn thành' },
  { key: RESERVATION_TAB.CANCELLED, label: 'Đã hủy' },
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

function formatDealTime(iso) {
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

function resolveSellerDealMoney(item) {
  const qty = Number(item.quantity) || 1;
  const originalUnit = Number(item.originalPrice) || 0;
  const originalTotal = originalUnit * qty;
  let offeredTotal = Number(item.offeredPrice) || 0;
  if (originalUnit > 0 && offeredTotal > 0 && offeredTotal <= originalUnit) {
    offeredTotal *= qty;
  }
  return {
    qty,
    originalTotal,
    offeredTotal,
    lastOfferBy: Number(item.lastOfferBy) || DEAL_OFFER_BY.BUYER,
  };
}

/** Seller-facing labels for the active offer line */
function getSellerDealOfferLine(item, money) {
  const fromSeller = money.lastOfferBy === DEAL_OFFER_BY.SELLER;

  if (item.status === DEAL_OFFER_STATUS.ACCEPTED) {
    if (fromSeller) {
      return { label: 'Khách đã chấp nhận', amount: money.offeredTotal };
    }
    return { label: 'Bạn đã chấp nhận', amount: money.offeredTotal };
  }

  if (fromSeller) {
    return { label: 'Giá bạn đề nghị', amount: money.offeredTotal };
  }
  return { label: 'Giá khách đề nghị', amount: money.offeredTotal };
}

function computeDealDiscountPercent(originalTotal, dealAmount) {
  if (!originalTotal || originalTotal <= 0 || dealAmount == null) {
    return 0;
  }
  return Math.max(0, Math.round(((originalTotal - dealAmount) / originalTotal) * 100));
}

function getActiveDealMessage(item) {
  const lastOfferBy = Number(item?.lastOfferBy) || DEAL_OFFER_BY.BUYER;
  if (lastOfferBy === DEAL_OFFER_BY.SELLER) {
    return String(item?.sellerNote || '').trim();
  }
  return String(item?.note || '').trim();
}

export default function SellerOrdersScreen({
  onBack,
  onOpenReservation,
  onRefreshKey = 0,
  embedded = false,
}) {
  const [activeTab, setActiveTab] = useState(RESERVATION_TAB.PENDING_PRICE);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [counterDeal, setCounterDeal] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerOrdersOnBackend({ idToken, tab: activeTab });
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
    }
  }, [activeTab]);

  useEffect(() => {
    setSearch('');
    loadOrders();
  }, [loadOrders, onRefreshKey]);

  const counterMoney = useMemo(
    () => (counterDeal ? resolveSellerDealMoney(counterDeal) : null),
    [counterDeal]
  );

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
      const note = String(item.note || item.sellerNote || '').toLowerCase();
      return (
        productName.includes(keyword) ||
        variantName.includes(keyword) ||
        buyerName.includes(keyword) ||
        id.includes(keyword) ||
        note.includes(keyword)
      );
    });
  }, [items, search]);

  async function handleAcceptDeal(deal) {
    const money = resolveSellerDealMoney(deal);
    Alert.alert(
      'Chấp nhận deal',
      `Bạn chấp nhận tổng ${formatPrice(money.offeredTotal)} (${money.qty} sp)?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Chấp nhận',
          onPress: async () => {
            try {
              const idToken = await getCurrentUserIdToken();
              await acceptSellerDealOnBackend(idToken, deal.id);
              Alert.alert('Thành công', 'Đã chấp nhận deal. Khách không thể hủy sau 15 phút.');
              loadOrders();
            } catch (actionError) {
              Alert.alert('Lỗi', actionError.message || 'Không chấp nhận được deal.');
            }
          },
        },
      ]
    );
  }

  async function handleRejectDeal(deal) {
    Alert.alert('Từ chối deal', 'Bạn chắc chắn từ chối đề nghị này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: async () => {
          try {
            const idToken = await getCurrentUserIdToken();
            await rejectSellerDealOnBackend({ idToken, dealId: deal.id, reason: 'Shop từ chối' });
            loadOrders();
          } catch (actionError) {
            Alert.alert('Lỗi', actionError.message || 'Không từ chối được deal.');
          }
        },
      },
    ]);
  }

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

  function openCounterModal(deal) {
    setCounterDeal(deal);
    setCounterPrice('');
    setCounterNote('');
  }

  async function handleCounterDeal() {
    if (!counterDeal) {
      return;
    }
    const nextTotal = Number(String(counterPrice || '').replace(/\D/g, ''));
    const note = String(counterNote || '').trim();
    if (!nextTotal) {
      Alert.alert('Thiếu giá', 'Vui lòng nhập tổng giá đề xuất.');
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      await counterSellerDealOnBackend({
        idToken,
        dealId: counterDeal.id,
        counterPrice: nextTotal,
        note,
      });
      setCounterDeal(null);
      setCounterPrice('');
      setCounterNote('');
      loadOrders();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được giá đề xuất.');
    }
  }

  function renderDealItem({ item }) {
    const statusLabel = DEAL_STATUS_LABELS[item.status] || 'Không rõ';
    const statusStyle = getDealStatusStyle(item.status);
    const money = resolveSellerDealMoney(item);
    const offerLine = getSellerDealOfferLine(item, money);
    const discountPercent = computeDealDiscountPercent(money.originalTotal, offerLine.amount);
    const dealNote = getActiveDealMessage(item);
    const thumb = item.product?.thumbnail || '';
    const productName = item.product?.productName || 'Sản phẩm';
    const variantName = item.variant?.variantName || '';
    const buyerName = item.buyer?.fullName || 'Khách';
    const waitingForShop =
      item.status === DEAL_OFFER_STATUS.PENDING && money.lastOfferBy === DEAL_OFFER_BY.BUYER;
    const waitingForBuyer =
      item.status === DEAL_OFFER_STATUS.PENDING && money.lastOfferBy === DEAL_OFFER_BY.SELLER;

    return (
      <View style={styles.card}>
        <OrderItemHeader
          id={item.id}
          statusLabel={statusLabel}
          statusBadgeStyle={statusStyle.badge}
          statusTextStyle={statusStyle.text}
          thumbnail={thumb}
          productName={productName}
          variantName={variantName}
          quantity={money.qty}
          unitPriceText={formatPrice(
            money.qty > 0 ? Math.round(offerLine.amount / money.qty) : offerLine.amount
          )}
          partyLine={`Khách: ${buyerName}`}
        >
          <Text style={styles.infoLine}>
            Giá niêm yết: {formatPrice(money.originalTotal)}
          </Text>
          <Text style={styles.infoLineStrong}>
            {offerLine.label}: {formatPrice(offerLine.amount)}
          </Text>
          {dealNote ? <Text style={styles.infoLineNote}>Lời nhắn: {dealNote}</Text> : null}
          <Text style={styles.infoLineDiscount}>Giảm {discountPercent}%</Text>
          <Text style={styles.infoLineMuted}>{formatDealTime(item.createdAt)}</Text>
          {waitingForBuyer ? (
            <Text style={styles.waitText}>Đang chờ người mua phản hồi</Text>
          ) : null}
        </OrderItemHeader>

        {waitingForShop ? (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, styles.actionButtonFlex]}
              onPress={() => handleAcceptDeal(item)}
            >
              <Text style={styles.actionButtonText}>Chấp nhận</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.actionButtonSecondary, styles.actionButtonFlex]}
              onPress={() => openCounterModal(item)}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                Trả giá
              </Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.actionButtonDanger, styles.actionButtonFlex]}
              onPress={() => handleRejectDeal(item)}
            >
              <Text style={styles.actionButtonTextDanger}>Từ chối</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
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
            {item.pickupTime ? (
              <Text style={styles.infoLineMuted}>
                Giờ lấy: {formatDealTime(item.pickupTime)}
              </Text>
            ) : (
              <Text style={styles.infoLineMuted}>Giữ: {formatDealTime(item.createdAt)}</Text>
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
          <ActivityIndicator color="#0d7377" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={
            activeTab === RESERVATION_TAB.PENDING_PRICE ? renderDealItem : renderReservationItem
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {search.trim() ? 'Không tìm thấy đơn phù hợp.' : 'Chưa có đơn trong mục này.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={Boolean(counterDeal)} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Trả giá khác</Text>
              {counterMoney ? (
                <>
                  <Text style={styles.modalHint}>
                    Giá niêm yết: {formatPrice(counterMoney.originalTotal)}
                  </Text>
                  <Text style={styles.modalHint}>
                    Giá khách đề nghị: {formatPrice(counterMoney.offeredTotal)}
                  </Text>
                </>
              ) : null}

              <Text style={styles.modalFieldLabel}>Tổng giá shop đề nghị</Text>
              <TextInput
                value={counterPrice}
                onChangeText={(value) => setCounterPrice(value.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="Nhập tổng giá"
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
              />

              <Text style={styles.modalFieldLabel}>Lời nhắn (tuỳ chọn)</Text>
              <TextInput
                value={counterNote}
                onChangeText={setCounterNote}
                placeholder="Ví dụ: giá đó mới bán được..."
                placeholderTextColor="#94a3b8"
                style={[styles.modalInput, styles.modalNoteInput]}
                multiline
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancel}
                  onPress={() => {
                    setCounterDeal(null);
                    setCounterPrice('');
                    setCounterNote('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Huỷ</Text>
                </Pressable>
                <Pressable style={styles.modalSubmit} onPress={handleCounterDeal}>
                  <Text style={styles.modalSubmitText}>Gửi</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  dealIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  orderCode: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
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
  cancelReasonText: {
    marginTop: 6,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
  dealProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  dealThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  dealThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d7377',
  },
  dealThumbFallbackText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  dealProductInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  dealProductTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  cardMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  buyerMeta: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  dealListedPrice: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  priceText: {
    color: '#0d7377',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  dealDiscountText: {
    marginTop: 4,
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800',
  },
  dealTimeText: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  dealNoteText: {
    marginTop: 2,
    marginBottom: 2,
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  waitText: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  infoLine: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  infoLineStrong: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  infoLineNote: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  infoLineDiscount: {
    color: '#0f766e',
    fontSize: 12,
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
    backgroundColor: '#0d7377',
  },
  actionButtonFlex: {
    flexGrow: 1,
    flexBasis: '30%',
  },
  actionButtonSecondary: {
    backgroundColor: '#e8f3f1',
  },
  actionButtonDanger: {
    backgroundColor: '#fee2e2',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  actionButtonTextSecondary: {
    color: '#0d7377',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 10,
  },
  modalHint: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalFieldLabel: {
    marginTop: 12,
    marginBottom: 6,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalInput: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  modalNoteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    fontWeight: '500',
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  modalCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#334155',
    fontWeight: '800',
  },
  modalSubmit: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});

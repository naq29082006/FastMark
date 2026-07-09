import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  acceptSellerDealOnBackend,
  counterSellerDealOnBackend,
  getSellerOrdersOnBackend,
  rejectSellerDealOnBackend,
} from '../../api/sellerOpsApi';
import { RESERVATION_TAB, RESERVATION_TAB_LABELS } from '../../constants/sellerOrders';
import { formatPrice } from '../../core/utils/productFormat';
import ProfileSubScreen from '../profile/ProfileSubScreen';

const TABS = [
  RESERVATION_TAB.PENDING_PRICE,
  RESERVATION_TAB.HOLDING,
  RESERVATION_TAB.CANCELLED,
  RESERVATION_TAB.COMPLETED,
];

export default function SellerOrdersScreen({ onBack, onOpenReservation, onRefreshKey = 0 }) {
  const [activeTab, setActiveTab] = useState(RESERVATION_TAB.HOLDING);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [counterDealId, setCounterDealId] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');

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
    loadOrders();
  }, [loadOrders, onRefreshKey]);

  async function handleAcceptDeal(dealId) {
    try {
      const idToken = await getCurrentUserIdToken();
      await acceptSellerDealOnBackend(idToken, dealId);
      Alert.alert('Thành công', 'Đã chấp nhận deal. Khách không thể hủy sau 15 phút.');
      loadOrders();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không chấp nhận được deal.');
    }
  }

  async function handleRejectDeal(dealId) {
    try {
      const idToken = await getCurrentUserIdToken();
      await rejectSellerDealOnBackend({ idToken, dealId, reason: 'Shop từ chối' });
      loadOrders();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không từ chối được deal.');
    }
  }

  async function handleCounterDeal() {
    if (!counterDealId || !counterPrice.trim()) {
      return;
    }
    try {
      const idToken = await getCurrentUserIdToken();
      await counterSellerDealOnBackend({
        idToken,
        dealId: counterDealId,
        counterPrice: Number(counterPrice),
      });
      setCounterDealId(null);
      setCounterPrice('');
      loadOrders();
    } catch (actionError) {
      Alert.alert('Lỗi', actionError.message || 'Không gửi được giá đề xuất.');
    }
  }

  function renderDealItem({ item }) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.product?.productName || 'Sản phẩm'}</Text>
        <Text style={styles.cardMeta}>
          {item.variant?.variantName || ''} • Khách: {item.buyer?.fullName || 'N/A'}
        </Text>
        <Text style={styles.priceText}>
          Giá gốc: {formatPrice(item.originalPrice)} → Đề xuất: {formatPrice(item.offeredPrice)}
        </Text>
        {item.sellerCounterPrice ? (
          <Text style={styles.counterText}>Giá shop đề xuất: {formatPrice(item.sellerCounterPrice)}</Text>
        ) : null}
        <View style={styles.actionRow}>
          <Pressable onPress={() => handleAcceptDeal(item.id)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Chấp nhận</Text>
          </Pressable>
          <Pressable onPress={() => setCounterDealId(item.id)} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Trả giá khác</Text>
          </Pressable>
          <Pressable onPress={() => handleRejectDeal(item.id)} style={styles.dangerBtn}>
            <Text style={styles.dangerBtnText}>Từ chối</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderReservationItem({ item }) {
    return (
      <Pressable style={styles.card} onPress={() => onOpenReservation?.(item.id)}>
        <Text style={styles.cardTitle}>{item.product?.productName || 'Sản phẩm'}</Text>
        <Text style={styles.cardMeta}>
          {item.variant?.variantName || ''} • SL: {item.quantity} • {item.buyer?.fullName || 'Khách'}
        </Text>
        <Text style={styles.priceText}>Tổng: {formatPrice(item.totalAmount)}</Text>
        {item.pickupTime ? (
          <Text style={styles.cardMeta}>Giờ lấy: {new Date(item.pickupTime).toLocaleString('vi-VN')}</Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Quản lý đơn hàng</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={2}>
                {RESERVATION_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={activeTab === RESERVATION_TAB.PENDING_PRICE ? renderDealItem : renderReservationItem}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Chưa có đơn trong mục này.</Text>
            </View>
          }
        />
      )}

      {counterDealId ? (
        <View style={styles.counterModal}>
          <Text style={styles.counterTitle}>Đề xuất giá khác</Text>
          <TextInput
            value={counterPrice}
            onChangeText={setCounterPrice}
            keyboardType="numeric"
            placeholder="Nhập giá (đ)"
            placeholderTextColor="#94a3b8"
            style={styles.counterInput}
          />
          <View style={styles.actionRow}>
            <Pressable onPress={() => setCounterDealId(null)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Hủy</Text>
            </Pressable>
            <Pressable onPress={handleCounterDeal} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Gửi</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  backButtonText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  title: { flex: 1, marginHorizontal: 12, color: '#ffffff', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  topBarSpacer: { width: 36 },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
  },
  tabItemActive: { backgroundColor: '#e8f3f1', borderColor: '#0d7377' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  tabTextActive: { color: '#0d7377' },
  listContent: { padding: 16, paddingBottom: 32, gap: 10 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  cardMeta: { color: '#64748b', fontSize: 13, marginTop: 4 },
  priceText: { color: '#0d7377', fontWeight: '800', marginTop: 8 },
  counterText: { color: '#b45309', fontSize: 13, marginTop: 4, fontWeight: '700' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  primaryBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  secondaryBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#e8f3f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#0d7377', fontWeight: '800', fontSize: 13 },
  dangerBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { color: '#b91c1c', fontWeight: '800', fontSize: 13 },
  centered: { alignItems: 'center', paddingVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#64748b', fontWeight: '600' },
  errorText: { color: '#b91c1c', paddingHorizontal: 16, paddingTop: 8, fontWeight: '700' },
  counterModal: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 4,
  },
  counterTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  counterInput: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
});

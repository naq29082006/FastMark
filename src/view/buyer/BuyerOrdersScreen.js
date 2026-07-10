import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { RESERVATION_TAB, RESERVATION_TAB_LABELS } from '../../constants/sellerOrders';
import { getBuyerOrdersForTab } from '../../model/mock/buyerOrdersMockData';
import { formatPrice } from '../../core/utils/productFormat';

const TABS = [
  RESERVATION_TAB.PENDING_PRICE,
  RESERVATION_TAB.HOLDING,
  RESERVATION_TAB.CANCELLED,
  RESERVATION_TAB.COMPLETED,
];

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

function BuyerOrdersContent({ activeTab, onOpenStore }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const data = getBuyerOrdersForTab(activeTab);
    if (activeTab === RESERVATION_TAB.PENDING_PRICE) {
      setItems(data.deals || []);
    } else {
      setItems(data.reservations || []);
    }
    setIsLoading(false);
  }, [activeTab]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function renderDealItem({ item }) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.productName}</Text>
        <Text style={styles.cardMeta}>
          {item.variantName} • {item.storeName}
        </Text>
        <Text style={styles.priceText}>
          Giá gốc: {formatPrice(item.originalPrice)} → Đề xuất: {formatPrice(item.offeredPrice)}
        </Text>
        {item.sellerCounterPrice ? (
          <Text style={styles.counterText}>
            Shop đề xuất: {formatPrice(item.sellerCounterPrice)}
          </Text>
        ) : (
          <Text style={styles.waitText}>Đang chờ shop phản hồi giá</Text>
        )}
      </View>
    );
  }

  function renderReservationItem({ item }) {
    const isHolding = activeTab === RESERVATION_TAB.HOLDING;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.productName}</Text>
        <Text style={styles.cardMeta}>
          {item.variantName} • SL: {item.quantity} • {item.storeName}
        </Text>
        <Text style={styles.priceText}>Tổng: {formatPrice(item.totalAmount)}</Text>
        <Text style={styles.cardMeta}>Giữ lúc: {formatDateTime(item.reservedAt)}</Text>
        {item.pickupTime ? (
          <Text style={styles.cardMeta}>Giờ lấy: {formatDateTime(item.pickupTime)}</Text>
        ) : null}
        {item.expiresAt ? (
          <Text style={styles.cardMeta}>Hết hạn: {formatDateTime(item.expiresAt)}</Text>
        ) : null}

        {isHolding ? (
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => item.storeId && onOpenStore?.(item.storeId)}
          >
            <Text style={styles.actionButtonText}>Đến lấy hàng</Text>
          </Pressable>
        ) : null}
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
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      renderItem={
        activeTab === RESERVATION_TAB.PENDING_PRICE ? renderDealItem : renderReservationItem
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Chưa có đơn trong mục này.</Text>
        </View>
      }
    />
  );
}

export default function BuyerOrdersScreen({ onOpenStore, embedded = true, onBack }) {
  const [activeTab, setActiveTab] = useState(RESERVATION_TAB.HOLDING);

  const tabBar = (
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
  );

  const body = <BuyerOrdersContent activeTab={activeTab} onOpenStore={onOpenStore} />;

  if (embedded) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
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
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
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
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
  topBarWithBack: {
    paddingTop: 56,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
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
    backgroundColor: '#ffffff',
  },
  tabItemActive: {
    borderColor: '#0d7377',
    backgroundColor: '#ecfdf5',
  },
  tabText: {
    fontSize: 12,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
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
    marginTop: 4,
  },
  waitText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  actionButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
});

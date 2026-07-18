import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useReviewedOrderCodes } from '../../hooks/useReviewedOrderCodes';
import OrderDetailScreen from './OrderDetailScreen';
import ProfileSubScreen from './ProfileSubScreen';
import PurchasedProductsScreen from './PurchasedProductsScreen';
import ReservationHistoryScreen from './ReservationHistoryScreen';
import MyReviewsScreen from './MyReviewsScreen';

const ACTIVITY_TABS = [
  { key: 'reservations', label: 'Lịch sử giữ hàng' },
  { key: 'purchases', label: 'Sản phẩm đã mua' },
  { key: 'reviews', label: 'Đánh giá của tôi' },
];

export default function MyActivityScreen({ onBack, onOpenStore }) {
  const [activeTab, setActiveTab] = useState('reservations');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const { reviewedOrderCodes, markReviewed } = useReviewedOrderCodes(reviewRefreshKey);

  function handleOrderReviewed(order) {
    markReviewed(order);
    setReviewRefreshKey((value) => value + 1);
  }

  if (selectedOrder) {
    return (
      <OrderDetailScreen
        order={selectedOrder}
        reviewedOrderCodes={reviewedOrderCodes}
        onBack={() => setSelectedOrder(null)}
        onOpenStore={onOpenStore}
        onOrderReviewed={handleOrderReviewed}
      />
    );
  }

  return (
    <ProfileSubScreen title="Hoạt động của tôi" onBack={onBack}>
      <View style={styles.tabRow}>
        {ACTIVITY_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={2}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'reservations' ? (
        <ReservationHistoryScreen
          embedded
          reviewedOrderCodes={reviewedOrderCodes}
          onOpenOrderDetail={(order) => setSelectedOrder({ ...order, type: 'reservation' })}
          onOpenStore={onOpenStore}
          onOrderReviewed={handleOrderReviewed}
        />
      ) : null}

      {activeTab === 'purchases' ? (
        <PurchasedProductsScreen
          embedded
          reviewedOrderCodes={reviewedOrderCodes}
          onOpenOrderDetail={(order) => setSelectedOrder({ ...order, type: 'purchase' })}
          onOpenStore={onOpenStore}
          onOrderReviewed={handleOrderReviewed}
        />
      ) : null}

      {activeTab === 'reviews' ? (
        <MyReviewsScreen refreshKey={reviewRefreshKey} />
      ) : null}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  tabItemActive: {
    backgroundColor: '#d1fae5',
  },
  tabText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#076F32',
    fontWeight: '900',
  },
});

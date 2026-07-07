import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MOCK_PURCHASES } from '../../data/activityMockData';
import ProfileSubScreen from './ProfileSubScreen';

function formatPrice(price) {
  return `${Number(price).toLocaleString('vi-VN')}đ`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatOrderTotal(price, quantity) {
  return Number(price || 0) * Number(quantity || 0);
}

export default function PurchasedProductsScreen({ onBack, onOpenStore }) {
  return (
    <ProfileSubScreen title="Sản phẩm đã từng mua" onBack={onBack}>
      {MOCK_PURCHASES.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderLabel}>Mã đơn hàng</Text>
            <Text style={styles.orderCode}>{item.orderCode}</Text>
          </View>

          <View style={styles.cardRow}>
            <View style={styles.productImage}>
              <Text style={styles.emoji}>{item.imageEmoji}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.productName}>{item.productName}</Text>
              <Text style={styles.storeName}>🏪 {item.storeName}</Text>

              <View style={styles.detailList}>
                <Text style={styles.detailText}>Số lượng mua: <Text style={styles.detailValue}>{item.quantity}</Text></Text>
                <Text style={styles.detailText}>Đơn giá: <Text style={styles.detailValue}>{formatPrice(item.price)}</Text></Text>
                <Text style={styles.detailText}>Tổng tiền: <Text style={styles.totalValue}>{formatPrice(formatOrderTotal(item.price, item.quantity))}</Text></Text>
                <Text style={styles.detailText}>Ngày mua: <Text style={styles.detailValue}>{formatDateTime(item.purchasedAt)}</Text></Text>
              </View>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => item.storeId && onOpenStore?.(item.storeId)}
          >
            <Text style={styles.actionButtonText}>Đến gian hàng</Text>
          </Pressable>
        </View>
      ))}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  orderLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderCode: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  productImage: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  emoji: {
    fontSize: 30,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  storeName: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  detailList: {
    marginTop: 8,
    gap: 5,
  },
  detailText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
  },
  detailValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  totalValue: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '900',
  },
  actionButton: {
    marginTop: 16,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  actionButtonPressed: {
    opacity: 0.82,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getReservationStatusLabel,
  MOCK_RESERVATIONS,
} from '../../data/activityMockData';
import ProfileSubScreen from './ProfileSubScreen';

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

const STATUS_COLORS = {
  active: { bg: '#d1fae5', text: '#047857' },
  picked_up: { bg: '#e0e7ff', text: '#4338ca' },
  expired: { bg: '#fee2e2', text: '#b91c1c' },
};

export default function ReservationHistoryScreen({ onBack, onOpenStore }) {
  return (
    <ProfileSubScreen title="Lịch sử giữ hàng" onBack={onBack}>
      {MOCK_RESERVATIONS.map((item) => {
        const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.active;
        const isActiveReservation = item.status === 'active';
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.productName}>{item.productName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                  {getReservationStatusLabel(item.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.storeName}>🏪 {item.storeName}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Số lượng: {item.quantity}</Text>
              <Text style={styles.metaText}>Giữ lúc: {formatDateTime(item.reservedAt)}</Text>
              <Text style={styles.metaText}>Hết hạn: {formatDateTime(item.expiresAt)}</Text>
            </View>

            {isActiveReservation ? (
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                onPress={() => item.storeId && onOpenStore?.(item.storeId)}
              >
                <Text style={styles.actionButtonText}>Đến lấy hàng</Text>
              </Pressable>
            ) : (
              <View style={styles.secondaryActionWrap}>
                <View style={styles.secondaryAction}>
                  <Text style={styles.secondaryActionText}>
                    {item.status === 'picked_up' ? 'Đã hoàn tất đơn giữ' : 'Phiếu giữ hàng đã hết hạn'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  productName: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  storeName: {
    marginTop: 8,
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  metaRow: {
    marginTop: 10,
    gap: 4,
  },
  metaText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
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
  secondaryActionWrap: {
    marginTop: 16,
  },
  secondaryAction: {
    minHeight: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryActionText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
});

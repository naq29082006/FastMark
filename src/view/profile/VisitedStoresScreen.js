import { StyleSheet, Text, View } from 'react-native';

import ProfileSubScreen from './ProfileSubScreen';

export default function VisitedStoresScreen({ onBack }) {
  return (
    <ProfileSubScreen title="Gian hàng đã ghé" onBack={onBack}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🗺️</Text>
        <Text style={styles.emptyTitle}>Chưa có lịch sử ghé thăm</Text>
        <Text style={styles.emptySubtitle}>
          Khi bạn xem gian hàng trên bản đồ, lịch sử sẽ hiển thị tại đây.
        </Text>
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 42,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
});

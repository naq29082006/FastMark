import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getSellerStatsOnBackend } from '../../api/sellerOpsApi';
import { formatPrice } from '../../core/utils/productFormat';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function StatCard({ label, value, highlight }) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function SellerStatsScreen({ onBack, embedded = false }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadStats = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getSellerStatsOnBackend(idToken);
      setStats(data);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được thống kê.');
      if (!refresh) {
        setStats(null);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    if (!embedded) {
      return undefined;
    }
    const timer = setInterval(() => {
      loadStats({ refresh: true });
    }, 20000);
    return () => clearInterval(timer);
  }, [embedded, loadStats]);

  if (isLoading && !stats) {
    return (
      <ProfileSubScreen title="Thống kê" onBack={onBack} embedded={embedded}>
        <View style={styles.centered}>
          <ActivityIndicator color="#0d7377" size="large" />
        </View>
      </ProfileSubScreen>
    );
  }

  if (!stats) {
    return (
      <ProfileSubScreen title="Thống kê" onBack={onBack} embedded={embedded}>
        <Text style={styles.errorText}>{error || 'Không có dữ liệu.'}</Text>
      </ProfileSubScreen>
    );
  }

  return (
    <ProfileSubScreen
      title="Thống kê"
      onBack={onBack}
      embedded={embedded}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadStats({ refresh: true })} />
      }
    >
      <Text style={styles.groupTitle}>Doanh thu</Text>
      <View style={styles.grid}>
        <StatCard label="Hôm nay" value={formatPrice(stats.dailyRevenue)} highlight />
        <StatCard label="Tháng này" value={formatPrice(stats.monthlyRevenue)} highlight />
        <StatCard label="Tổng cộng" value={formatPrice(stats.totalRevenue)} />
      </View>

      <Text style={styles.groupTitle}>Đơn giữ hàng</Text>
      <View style={styles.grid}>
        <StatCard label="Chờ xác nhận" value={String(stats.reservations?.pending || 0)} />
        <StatCard label="Đang giữ" value={String(stats.reservations?.confirmed || 0)} />
        <StatCard label="Đã hủy" value={String(stats.reservations?.cancelled || 0)} />
        <StatCard label="Hoàn thành" value={String(stats.reservations?.completed || 0)} />
      </View>

      <Text style={styles.groupTitle}>Tương tác</Text>
      <View style={styles.grid}>
        <StatCard label="Người theo dõi" value={String(stats.followersCount || 0)} />
        <StatCard label="Đang theo dõi" value={String(stats.followingCount || 0)} />
        <StatCard label="Lượt thích SP" value={String(stats.productLikes || 0)} />
        <StatCard label="Yêu thích gian hàng" value={String(stats.shopLikes || 0)} />
        <StatCard label="Đã bán" value={String(stats.soldCount || 0)} />
        <StatCard label="Sản phẩm" value={String(stats.totalProducts || 0)} />
      </View>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 40 },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statCardHighlight: {
    borderColor: '#0d7377',
    backgroundColor: '#f0fdfa',
  },
  statValue: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '700', marginTop: 4 },
  errorText: { color: '#b91c1c', fontWeight: '700' },
});

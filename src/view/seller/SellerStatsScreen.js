import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getSellerStatsOnBackend } from '../../api/sellerOpsApi';
import { formatPrice } from '../../core/utils/productFormat';
import { formatDateString } from '../../core/utils/dateFormat';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import DatePickerField from '../shared/components/DatePickerField';

const RANGE_PRESETS = [
  { key: '1d', label: '1 ngày' },
  { key: '7d', label: '7 ngày' },
  { key: '1m', label: '1 tháng' },
  { key: 'custom', label: 'Tùy chọn' },
];

function StatCard({ label, value, highlight }) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function toApiDate(dateInput) {
  const parts = String(dateInput || '').trim().split('/');
  if (parts.length !== 3) {
    return '';
  }
  const [day, month, year] = parts;
  if (!day || !month || !year) {
    return '';
  }
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export default function SellerStatsScreen({ onBack, embedded = false }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [rangeKey, setRangeKey] = useState('7d');
  const [customFrom, setCustomFrom] = useState(formatDateString(new Date()));
  const [customTo, setCustomTo] = useState(formatDateString(new Date()));

  const loadStats = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError('');
      try {
        const idToken = await getCurrentUserIdToken();
        const params =
          rangeKey === 'custom'
            ? { range: 'custom', from: toApiDate(customFrom), to: toApiDate(customTo) }
            : { range: rangeKey };
        if (rangeKey === 'custom' && (!params.from || !params.to)) {
          throw new Error('Vui lòng chọn đầy đủ khoảng thời gian.');
        }
        const data = await getSellerStatsOnBackend(idToken, params);
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
    },
    [rangeKey, customFrom, customTo]
  );

  useEffect(() => {
    if (rangeKey === 'custom') {
      return undefined;
    }
    loadStats();
    if (!embedded) {
      return undefined;
    }
    const timer = setInterval(() => {
      loadStats({ refresh: true });
    }, 20000);
    return () => clearInterval(timer);
  }, [embedded, loadStats, rangeKey]);

  useEffect(() => {
    if (rangeKey !== 'custom') {
      return undefined;
    }
    if (!toApiDate(customFrom) || !toApiDate(customTo)) {
      return undefined;
    }
    loadStats();
    return undefined;
  }, [rangeKey, customFrom, customTo, loadStats]);

  if (isLoading && !stats) {
    return (
      <ProfileSubScreen title="Thống kê" onBack={onBack} embedded={embedded}>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
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

  const periodReservations = stats.periodReservations || stats.reservations || {};

  return (
    <ProfileSubScreen
      title="Thống kê"
      onBack={onBack}
      embedded={embedded}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadStats({ refresh: true })} />
      }
    >
      <Text style={styles.groupTitle}>Khoảng thời gian</Text>
      <View style={styles.chipRow}>
        {RANGE_PRESETS.map((preset) => {
          const active = rangeKey === preset.key;
          return (
            <Pressable
              key={preset.key}
              onPress={() => setRangeKey(preset.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{preset.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {rangeKey === 'custom' ? (
        <View style={styles.customRow}>
          <View style={styles.customField}>
            <DatePickerField label="Từ ngày" value={customFrom} onChange={setCustomFrom} />
          </View>
          <View style={styles.customField}>
            <DatePickerField label="Đến ngày" value={customTo} onChange={setCustomTo} />
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.groupTitle}>Doanh thu đơn giữ hàng</Text>
      <View style={styles.grid}>
        <StatCard label="Trong kỳ" value={formatPrice(stats.periodRevenue)} highlight />
        <StatCard label="Hôm nay" value={formatPrice(stats.dailyRevenue)} />
        <StatCard label="Tháng này" value={formatPrice(stats.monthlyRevenue)} />
        <StatCard label="Tổng cộng" value={formatPrice(stats.totalRevenue)} />
      </View>

      <Text style={styles.groupTitle}>Đơn giữ hàng trong kỳ</Text>
      <View style={styles.grid}>
        <StatCard label="Chờ xác nhận" value={String(periodReservations.pending || 0)} />
        <StatCard label="Đang giữ" value={String(periodReservations.confirmed || 0)} />
        <StatCard label="Đã hủy" value={String(periodReservations.cancelled || 0)} />
        <StatCard label="Hoàn thành" value={String(periodReservations.completed || 0)} />
      </View>

      <Text style={styles.groupTitle}>Tương tác</Text>
      <View style={styles.grid}>
        <StatCard label="Đã bán trong kỳ" value={String(stats.periodSoldCount || 0)} highlight />
        <StatCard label="Người theo dõi" value={String(stats.followersCount || 0)} />
        <StatCard label="Lượt thích SP" value={String(stats.productLikes || 0)} />
        <StatCard label="Tổng đã bán" value={String(stats.soldCount || 0)} />
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: '#076F32',
    backgroundColor: '#ecfeff',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  chipTextActive: {
    color: '#076F32',
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  customField: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statCardHighlight: {
    borderColor: '#A7D9B8',
    backgroundColor: '#f0fdfa',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '700',
    marginBottom: 10,
  },
});

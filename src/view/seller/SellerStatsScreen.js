import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import { getSellerStatsOnBackend } from '../../api/sellerOpsApi';
import { showErrorAlert } from '../../core/utils/appAlert';
import { formatPrice } from '../../core/utils/productFormat';
import { formatDateString } from '../../core/utils/dateFormat';
import { isSameData } from '../../core/utils/realtimeList';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import DatePickerField from '../shared/components/DatePickerField';
import AvatarBadge from '../shared/components/AvatarBadge';

const RANGE_PRESETS = [
  { key: '1d', label: '1 ngày' },
  { key: '7d', label: '7 ngày' },
  { key: '1m', label: '1 tháng' },
  { key: '3m', label: '3 tháng' },
  { key: 'custom', label: 'Tùy chọn', icon: 'calendar-outline' },
];

const OVERVIEW_TILES = [
  { key: 'revenue', label: 'Tổng doanh thu', bg: '#ecfdf3', border: '#bbf7d0', accent: '#076F32', trendKey: 'periodRevenue', valueKey: 'periodRevenue', format: 'price' },
  { key: 'orders', label: 'Đơn hoàn thành', bg: '#eff6ff', border: '#bfdbfe', accent: '#1d4ed8', trendKey: 'periodCompleted', valueKey: 'periodCompletedOrders', format: 'count', suffix: ' đơn' },
  { key: 'products', label: 'Tổng sản phẩm', bg: '#fff7ed', border: '#fed7aa', accent: '#c2410c', trendKey: 'tongSP', valueKey: 'tongSP', format: 'count', suffix: ' sản phẩm' },
  { key: 'followers', label: 'Người theo dõi', bg: '#f5f3ff', border: '#ddd6fe', accent: '#6d28d9', trendKey: 'followers', valueKey: 'soNguoiTheo', format: 'count' },
];

const ORDER_STATUS_ITEMS = [
  { key: 'total', label: 'Tổng đơn', color: '#f8fafc', text: '#0f172a' },
  { key: 'pending', label: 'Chờ xác nhận', color: '#fef3c7', text: '#92400e' },
  { key: 'holding', label: 'Đang giữ', color: '#dbeafe', text: '#1e40af' },
  { key: 'waitingPickup', label: 'Chờ nhận hàng', color: '#e0e7ff', text: '#3730a3' },
  { key: 'pickupConfirmed', label: 'Đã nhận hàng', color: '#ccfbf1', text: '#0f766e' },
  { key: 'disputed', label: 'Tranh chấp', color: '#fee2e2', text: '#b91c1c' },
  { key: 'completed', label: 'Hoàn thành', color: '#dcfce7', text: '#166534' },
  { key: 'cancelled', label: 'Đã hủy', color: '#f1f5f9', text: '#475569' },
];

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

function formatTrend(value) {
  const pct = Number(value) || 0;
  if (pct === 0) {
    return { text: '0%', positive: true };
  }
  return {
    text: `${pct > 0 ? '+' : ''}${pct}%`,
    positive: pct >= 0,
  };
}

function formatOverviewValue(stats, tile) {
  const raw = stats?.[tile.valueKey];
  if (tile.format === 'price') {
    return formatPrice(raw);
  }
  return `${Number(raw) || 0}${tile.suffix || ''}`;
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TrendBadge({ value }) {
  const trend = formatTrend(value);
  return (
    <View style={styles.trendBadge}>
      <Ionicons
        name={trend.positive ? 'trending-up' : 'trending-down'}
        size={12}
        color={trend.positive ? '#076F32' : '#b91c1c'}
      />
      <Text style={[styles.trendBadgeText, trend.positive ? styles.trendUp : styles.trendDown]}>
        {trend.text}
      </Text>
    </View>
  );
}

function OverviewTile({ tile, stats, trendValue }) {
  return (
    <View style={[styles.overviewTile, { backgroundColor: tile.bg, borderColor: tile.border }]}>
      <Text style={[styles.overviewTileLabel, { color: tile.accent }]}>{tile.label}</Text>
      <Text style={styles.overviewTileValue}>{formatOverviewValue(stats, tile)}</Text>
      <TrendBadge value={trendValue} />
    </View>
  );
}

function RevenueSection({ stats }) {
  const items = [
    { key: 'period', label: 'Trong kỳ', value: formatPrice(stats.periodRevenue), highlight: true },
    { key: 'today', label: 'Hôm nay', value: formatPrice(stats.dailyRevenue) },
    { key: 'month', label: 'Tháng này', value: formatPrice(stats.monthlyRevenue) },
    { key: 'avg', label: 'Giá trị đơn trung bình', value: formatPrice(stats.averageOrderValue) },
    { key: 'total', label: 'Tổng cộng', value: formatPrice(stats.totalRevenue) },
  ];

  return (
    <View style={styles.revenueGrid}>
      {items.map((item) => (
        <View
          key={item.key}
          style={[
            styles.revenueTile,
            item.highlight && styles.revenueTileHighlight,
          ]}
        >
          <Text style={[styles.revenueTileLabel, item.highlight && styles.revenueTileLabelHighlight]}>
            {item.label}
          </Text>
          <Text style={[styles.revenueTileValue, item.highlight && styles.revenueTileValueHighlight]}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function OrderStatusGrid({ periodReservations = {} }) {
  return (
    <View style={styles.orderStatusGrid}>
      {ORDER_STATUS_ITEMS.map((item) => (
        <View key={item.key} style={[styles.orderStatusTile, { backgroundColor: item.color }]}>
          <Text style={[styles.orderStatusValue, { color: item.text }]}>
            {String(periodReservations[item.key] || 0)}
          </Text>
          <Text style={[styles.orderStatusLabel, { color: item.text }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function CompletionBar({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={styles.completionWrap}>
      <View style={styles.completionTrack}>
        <View style={[styles.completionFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.completionText}>Tỷ lệ hoàn thành: {pct}%</Text>
    </View>
  );
}

function ProductSection({ stats }) {
  const topProducts = Array.isArray(stats?.topSellingProducts) ? stats.topSellingProducts : [];
  const topBuyers = Array.isArray(stats?.topBuyers) ? stats.topBuyers : [];
  const statItems = [
    { value: stats.tongSP || 0, label: 'Tổng sản phẩm' },
    { value: stats.activeProducts || 0, label: 'Đang bán' },
    { value: stats.outOfStockProducts || 0, label: 'Hết hàng' },
    { value: stats.periodSoldCount || 0, label: 'Đã bán trong kỳ' },
    { value: stats.productViews || 0, label: 'Lượt xem sản phẩm' },
    { value: stats.productLikes || 0, label: 'Sản phẩm yêu thích' },
  ];

  return (
    <View style={styles.productsLayout}>
      <View style={styles.productsGrid}>
        {statItems.map((item) => (
          <View key={item.label} style={styles.productStatTile}>
            <Text style={styles.productStatValue}>{item.value}</Text>
            <Text style={styles.productStatLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      {topProducts.length > 0 ? (
        <View style={styles.topProductsWrap}>
          <Text style={styles.topProductsHeading}>Top sản phẩm bán chạy</Text>
          {topProducts.map((item) => (
            <View key={item.productId} style={styles.topProductCard}>
              <View style={styles.topProductRank}>
                <Text style={styles.topProductRankText}>{item.rank}</Text>
              </View>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.topProductImage} />
              ) : (
                <View style={styles.topProductImagePlaceholder}>
                  <Ionicons name="image-outline" size={22} color="#94a3b8" />
                </View>
              )}
              <View style={styles.topProductContent}>
                <Text style={styles.topProductName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.topProductMeta}>{item.orderCount || 0} đơn trong kỳ</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {topBuyers.length > 0 ? (
        <View style={styles.topBuyersWrap}>
          <Text style={styles.topBuyersHeading}>Top khách mua nhiều nhất</Text>
          {topBuyers.map((item) => (
            <View key={item.userId} style={styles.topBuyerCard}>
              <View style={styles.topProductRank}>
                <Text style={styles.topBuyerRankText}>{item.rank}</Text>
              </View>
              <AvatarBadge name={item.name} uri={item.avatar} size={44} />
              <View style={styles.topBuyerContent}>
                <Text style={styles.topBuyerName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.topBuyerMeta}>
                  {item.orderCount || 0} đơn · {formatPrice(item.totalAmount || 0)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RatingSection({ diemTB, tongDG, breakdown = {} }) {
  const rows = [5, 4, 3, 2, 1];
  const maxCount = Math.max(...rows.map((star) => Number(breakdown[star]) || 0), 1);
  const ratingText = Number(diemTB) > 0 ? `${Number(diemTB).toFixed(1)}/5` : '—';

  return (
    <View style={styles.ratingSection}>
      <View style={styles.ratingLeft}>
        <Text style={styles.ratingValue}>{ratingText}</Text>
        <View style={styles.ratingStars}>
          {rows.map((star) => (
            <Ionicons
              key={star}
              name={Number(diemTB) >= star ? 'star' : 'star-outline'}
              size={14}
              color="#f59e0b"
            />
          ))}
        </View>
        <Text style={styles.ratingCountLine}>Từ {tongDG || 0} lượt đánh giá</Text>
      </View>
      <View style={styles.ratingBars}>
        {rows.map((star) => {
          const count = Number(breakdown[star]) || 0;
          const widthPct = Math.max(count > 0 ? 6 : 0, Math.round((count / maxCount) * 100));
          return (
            <View key={star} style={styles.ratingBarRow}>
              <Text style={styles.ratingBarStar}>{star}</Text>
              <View style={styles.ratingBarTrack}>
                <View style={[styles.ratingBarFill, { width: `${widthPct}%` }]} />
              </View>
              <Text style={styles.ratingBarCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getComparisonLabel(rangeKey) {
  if (rangeKey === '1d') return 'So với hôm qua';
  if (rangeKey === '1m') return 'So với 30 ngày trước';
  if (rangeKey === '3m') return 'So với 3 tháng trước';
  if (rangeKey === 'custom') return 'So với kỳ trước';
  return 'So với 7 ngày trước';
}

export default function SellerStatsScreen({ onBack, embedded = false }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
        // Chỉ đổi state khi số liệu thật sự khác → không nháy khối thống kê.
        setStats((current) => (isSameData(current, data) ? current : data));
      } catch (loadError) {
        if (!refresh) {
          showErrorAlert(loadError.message || 'Không tải được thống kê.');
        }
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

  const periodReservations = stats?.periodReservations || {};
  const overviewTrends = stats?.overviewTrends || {};
  const comparisonLabel = useMemo(() => getComparisonLabel(rangeKey), [rangeKey]);

  if (isLoading && !stats) {
    return (
      <ProfileSubScreen title="Thống kê gian hàng" onBack={onBack} embedded={embedded}>
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </ProfileSubScreen>
    );
  }

  if (!stats) {
    return (
      <ProfileSubScreen title="Thống kê gian hàng" onBack={onBack} embedded={embedded}>
        <Text style={styles.errorText}>Không có dữ liệu.</Text>
      </ProfileSubScreen>
    );
  }

  return (
    <ProfileSubScreen
      title="Thống kê gian hàng"
      onBack={onBack}
      embedded={embedded}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadStats({ refresh: true })} />
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {RANGE_PRESETS.map((preset) => {
          const active = rangeKey === preset.key;
          return (
            <Pressable
              key={preset.key}
              onPress={() => setRangeKey(preset.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              {preset.icon ? (
                <Ionicons
                  name={preset.icon}
                  size={14}
                  color={active ? '#ffffff' : '#64748b'}
                  style={styles.chipIcon}
                />
              ) : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{preset.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

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

      <SectionCard title="Tổng quan">
        <View style={styles.comparisonRow}>
          <Text style={styles.comparisonText}>{comparisonLabel}</Text>
          <TrendBadge value={overviewTrends.periodRevenue} />
        </View>
        <View style={styles.overviewGrid}>
          {OVERVIEW_TILES.map((tile) => (
            <OverviewTile
              key={tile.key}
              tile={tile}
              stats={stats}
              trendValue={overviewTrends[tile.trendKey]}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Doanh thu đơn giữ hàng">
        <RevenueSection stats={stats} />
      </SectionCard>

      <SectionCard title="Đơn giữ hàng trong kỳ">
        <OrderStatusGrid periodReservations={periodReservations} />
        <CompletionBar value={periodReservations.completionRate} />
      </SectionCard>

      <SectionCard title="Sản phẩm">
        <ProductSection stats={stats} />
      </SectionCard>

      <SectionCard title="Đánh giá gian hàng">
        <RatingSection
          diemTB={stats.diemTB}
          tongDG={stats.tongDG}
          breakdown={stats.ratingBreakdown}
        />
      </SectionCard>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 40 },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: '#076F32',
    backgroundColor: '#076F32',
  },
  chipIcon: {
    marginRight: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  customField: {
    flex: 1,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  comparisonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  trendUp: {
    color: '#076F32',
  },
  trendDown: {
    color: '#b91c1c',
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  overviewTile: {
    width: '47%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  overviewTileLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  overviewTileValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  revenueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  revenueTile: {
    width: '47%',
    minWidth: '46%',
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  revenueTileHighlight: {
    width: '100%',
    backgroundColor: '#ecfdf3',
    borderColor: '#bbf7d0',
  },
  revenueTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  revenueTileLabelHighlight: {
    color: '#076F32',
  },
  revenueTileValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  revenueTileValueHighlight: {
    fontSize: 20,
    color: '#076F32',
  },
  orderStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderStatusTile: {
    width: '31%',
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  orderStatusValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  orderStatusLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  completionWrap: {
    marginTop: 12,
    gap: 6,
  },
  completionTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#076F32',
  },
  completionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#076F32',
  },
  productsLayout: {
    gap: 10,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productStatTile: {
    width: '31%',
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  productStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  productStatLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 14,
  },
  topProductsWrap: {
    gap: 8,
  },
  topProductsHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#c2410c',
  },
  topProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    padding: 10,
  },
  topProductRank: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProductRankText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#c2410c',
  },
  topProductImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  topProductImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProductContent: {
    flex: 1,
    gap: 2,
  },
  topProductName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  topProductMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
  },
  topBuyersWrap: {
    gap: 8,
    marginTop: 4,
  },
  topBuyersHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  topBuyerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    padding: 10,
  },
  topBuyerRankText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1d4ed8',
  },
  topBuyerContent: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  topBuyerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  topBuyerMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  ratingSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
  },
  ratingLeft: {
    width: 108,
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingCountLine: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  ratingBars: {
    flex: 1,
    minWidth: 140,
    gap: 6,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingBarStar: {
    width: 12,
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textAlign: 'center',
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f59e0b',
  },
  ratingBarCount: {
    width: 24,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'right',
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '700',
    marginBottom: 10,
  },
});

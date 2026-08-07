import { useMemo } from 'react';
import { Card, Skeleton } from 'antd';

import DashboardDateRange from '../../components/DashboardDateRange';
import { formatCurrency, formatNumber } from '../utils/format';

function computeTrendPercent(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) {
    if (c > 0) return { signed: 100 };
    return { signed: 0 };
  }
  const signed = ((c - p) / p) * 100;
  return { signed };
}

function TrendBadge({ current, previous, periodDays }) {
  const { signed } = computeTrendPercent(current, previous);
  const up = signed >= 0;
  const rounded =
    Math.abs(signed) >= 100 || Number.isInteger(signed)
      ? Math.round(signed)
      : Math.round(signed * 10) / 10;
  const text = `${rounded >= 0 ? '+' : ''}${rounded}%`;
  const className = up
    ? 'admin-dashboard-overview-trend up'
    : 'admin-dashboard-overview-trend down';
  const days = Math.max(1, Number(periodDays) || 30);

  return (
    <span className={className} title={`So với ${days} ngày trước`}>
      {text}
    </span>
  );
}

function OverviewStatCard({
  title,
  value,
  isCurrency = false,
  loading,
  trendCurrent,
  trendPrevious,
  periodDays,
}) {
  const numericValue = Number(value) || 0;
  const display = isCurrency ? formatCurrency(numericValue) : formatNumber(numericValue);

  return (
    <Card size="small" className="admin-stat-card-item admin-dashboard-overview-stat">
      {loading ? (
        <Skeleton active paragraph={false} title={{ width: '60%' }} />
      ) : (
        <>
          <div className="admin-dashboard-overview-stat-head">
            <div className="admin-stat-card-item-title">{title}</div>
            <TrendBadge
              current={trendCurrent}
              previous={trendPrevious}
              periodDays={periodDays}
            />
          </div>
          <div className="admin-stat-card-item-value">{display}</div>
        </>
      )}
    </Card>
  );
}

export default function DashboardSystemOverview({
  loading = false,
  from,
  to,
  preset,
  onApply,
  periodDays = 30,
  cards = {},
  metrics = {},
  previousPeriod = {},
}) {
  const items = useMemo(
    () => [
      {
        key: 'users',
        title: 'Người dùng',
        value: cards.totalUsers ?? 0,
        trendCurrent: metrics.newUsers,
        trendPrevious: previousPeriod.newUsers,
      },
      {
        key: 'shops',
        title: 'Gian hàng',
        value: cards.totalShops ?? cards.totalSellers ?? 0,
        trendCurrent: metrics.newSellers ?? metrics.newShops,
        trendPrevious: previousPeriod.newSellers ?? previousPeriod.newShops,
      },
      {
        key: 'products',
        title: 'Sản phẩm',
        value: cards.totalProducts ?? 0,
        trendCurrent: metrics.newProducts,
        trendPrevious: previousPeriod.newProducts,
      },
      {
        key: 'revenue',
        title: 'Doanh thu',
        isCurrency: true,
        value:
          cards.platformRevenueAllTime ??
          (Number(cards.sellerPlanRevenueAllTime) || 0) +
            (Number(cards.bannerPlanRevenueAllTime) || 0) +
            (Number(cards.depositAllTime) || 0),
        trendCurrent: metrics.platformRevenue,
        trendPrevious: previousPeriod.platformRevenue,
      },
      {
        key: 'orders',
        title: 'Đơn hàng',
        value: cards.totalReservations ?? 0,
        trendCurrent: metrics.newReservations,
        trendPrevious: previousPeriod.newReservations,
      },
    ],
    [cards, metrics, previousPeriod]
  );

  return (
    <section className="admin-dashboard-overview">
      <div className="admin-dashboard-overview-head">
        <h2 className="admin-dashboard-overview-title">Tổng quan hệ thống</h2>
        <DashboardDateRange from={from} to={to} preset={preset} onApply={onApply} />
      </div>
      <div className="admin-stat-cards-section">
        <div className="admin-stat-cards-grid" style={{ '--stat-columns': 5 }}>
          {items.map((item) => (
            <OverviewStatCard
              key={item.key}
              title={item.title}
              value={item.value}
              isCurrency={item.isCurrency}
              loading={loading}
              trendCurrent={item.trendCurrent}
              trendPrevious={item.trendPrevious}
              periodDays={periodDays}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

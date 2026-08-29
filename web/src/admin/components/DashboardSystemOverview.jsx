import { useMemo } from 'react';
import {
  AppstoreOutlined,
  DollarOutlined,
  LineChartOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Card, Skeleton } from 'antd';

import AdminDateFilter from '../../components/admin/AdminDateFilter';
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
  valueSuffix,
  valueSuffixTitle,
  hideTrend = false,
  icon,
  tone = 'slate',
}) {
  const numericValue = Number(value) || 0;
  const display = isCurrency ? formatCurrency(numericValue) : formatNumber(numericValue);

  return (
    <Card size="small" className="admin-stat-card-item admin-dashboard-overview-stat">
      {loading ? (
        <Skeleton active paragraph={false} title={{ width: '60%' }} />
      ) : (
        <div className="admin-dashboard-overview-stat-inner">
          {icon ? (
            <div className={`admin-stat-card-icon tone-${tone}`}>{icon}</div>
          ) : null}
          <div className="admin-dashboard-overview-stat-content">
            <div className="admin-dashboard-overview-stat-head">
              <div className="admin-stat-card-item-title">{title}</div>
              {!hideTrend ? (
                <TrendBadge
                  current={trendCurrent}
                  previous={trendPrevious}
                  periodDays={periodDays}
                />
              ) : null}
            </div>
            <div className="admin-stat-card-item-value admin-dashboard-overview-stat-value">
              <span>{display}</span>
              {valueSuffix ? (
                <span
                  className="admin-dashboard-overview-value-suffix"
                  title={valueSuffixTitle || undefined}
                >
                  · {valueSuffix}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function OverviewStatGrid({ items, loading, periodDays, columns, className }) {
  return (
    <div
      className={['admin-stat-cards-grid', className].filter(Boolean).join(' ')}
      style={{ '--stat-columns': columns }}
    >
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
          valueSuffix={item.valueSuffix}
          valueSuffixTitle={item.valueSuffixTitle}
          hideTrend={item.hideTrend}
          icon={item.icon}
          tone={item.tone}
        />
      ))}
    </div>
  );
}

export default function DashboardSystemOverview({
  loading = false,
  cards = {},
  metrics = {},
  previousPeriod = {},
  periodDays = 30,
  isAllTime = true,
  from,
  to,
  preset,
  onDateApply,
}) {
  const overviewItems = useMemo(() => {
    const orderValueAllTime = Number(cards.orderValueAllTime) || 0;
    const depositAllTime = Number(cards.depositAllTime) || 0;
    const depositShareOfOrder =
      orderValueAllTime > 0 ? (depositAllTime / orderValueAllTime) * 100 : null;

    if (isAllTime) {
      const primary = [
        {
          key: 'users',
          title: 'Người dùng',
          value: cards.totalUsers ?? 0,
          icon: <UserOutlined />,
          tone: 'blue',
          hideTrend: true,
        },
        {
          key: 'shops',
          title: 'Gian hàng',
          value: cards.totalShops ?? cards.totalSellers ?? 0,
          icon: <ShopOutlined />,
          tone: 'green',
          hideTrend: true,
        },
        {
          key: 'products',
          title: 'Sản phẩm',
          value: cards.tongSP ?? 0,
          icon: <AppstoreOutlined />,
          tone: 'purple',
          hideTrend: true,
        },
        {
          key: 'orders',
          title: 'Đơn hàng',
          value: cards.totalReservations ?? 0,
          icon: <ShoppingCartOutlined />,
          tone: 'amber',
          hideTrend: true,
        },
      ];

      const finance = [
        {
          key: 'orderValue',
          title: 'Giá trị đơn',
          isCurrency: true,
          value: orderValueAllTime,
          icon: <LineChartOutlined />,
          tone: 'green',
          hideTrend: true,
        },
        {
          key: 'deposit',
          title: 'Tiền đặt cọc',
          isCurrency: true,
          value: depositAllTime,
          icon: <DollarOutlined />,
          tone: 'teal',
          hideTrend: true,
          valueSuffix:
            depositShareOfOrder != null
              ? `${
                  depositShareOfOrder >= 100 || Number.isInteger(depositShareOfOrder)
                    ? Math.round(depositShareOfOrder)
                    : Math.round(depositShareOfOrder * 10) / 10
                }%`
              : '—',
          valueSuffixTitle: 'Tỷ lệ so với giá trị đơn',
        },
        {
          key: 'packageRevenue',
          title: 'Doanh thu gói bán',
          isCurrency: true,
          value:
            cards.packageRevenueAllTime ??
            (Number(cards.sellerPlanRevenueAllTime) || 0) +
              (Number(cards.bannerPlanRevenueAllTime) || 0),
          icon: <WalletOutlined />,
          tone: 'purple',
          hideTrend: true,
        },
      ];

      return [...primary, ...finance];
    }

    const prev = previousPeriod || {};
    const orderValue =
      Number(metrics.orderValue ?? metrics.orderRevenue) || 0;
    const depositAmount = Number(metrics.depositAmount) || 0;
    const depositShare =
      orderValue > 0 ? (depositAmount / orderValue) * 100 : null;

    const primary = [
      {
        key: 'users',
        title: 'Người dùng mới',
        value: metrics.newUsers ?? cards.newUsersInRange ?? 0,
        trendCurrent: metrics.newUsers,
        trendPrevious: prev.newUsers,
        icon: <UserOutlined />,
        tone: 'blue',
      },
      {
        key: 'shops',
        title: 'Gian hàng mới',
        value: metrics.newSellers ?? 0,
        trendCurrent: metrics.newSellers,
        trendPrevious: prev.newSellers,
        icon: <ShopOutlined />,
        tone: 'green',
      },
      {
        key: 'products',
        title: 'Sản phẩm mới',
        value: metrics.newProducts ?? 0,
        trendCurrent: metrics.newProducts,
        trendPrevious: prev.newProducts,
        icon: <AppstoreOutlined />,
        tone: 'purple',
      },
      {
        key: 'orders',
        title: 'Đơn mới',
        value: metrics.newReservations ?? cards.reservationsInRange ?? 0,
        trendCurrent: metrics.newReservations,
        trendPrevious: prev.newReservations,
        icon: <ShoppingCartOutlined />,
        tone: 'amber',
      },
    ];

    const finance = [
      {
        key: 'orderValue',
        title: 'Giá trị đơn',
        isCurrency: true,
        value: orderValue,
        trendCurrent: metrics.orderValue ?? metrics.orderRevenue,
        trendPrevious: prev.orderValue ?? prev.orderRevenue,
        icon: <LineChartOutlined />,
        tone: 'green',
      },
      {
        key: 'deposit',
        title: 'Tiền đặt cọc',
        isCurrency: true,
        value: depositAmount,
        trendCurrent: metrics.depositAmount,
        trendPrevious: prev.depositAmount,
        icon: <DollarOutlined />,
        tone: 'teal',
        valueSuffix:
          depositShare != null
            ? `${
                depositShare >= 100 || Number.isInteger(depositShare)
                  ? Math.round(depositShare)
                  : Math.round(depositShare * 10) / 10
              }%`
            : '—',
        valueSuffixTitle: 'Tỷ lệ so với giá trị đơn trong kỳ',
      },
      {
        key: 'packageRevenue',
        title: 'Doanh thu gói bán',
        isCurrency: true,
        value: metrics.revenue ?? 0,
        trendCurrent: metrics.revenue,
        trendPrevious: prev.revenue,
        icon: <WalletOutlined />,
        tone: 'purple',
      },
    ];

    return [...primary, ...finance];
  }, [cards, isAllTime, metrics, previousPeriod]);

  return (
    <section className="admin-dashboard-overview">
      <div className="admin-dashboard-overview-head">
        <div className="admin-finance-date-inline">
          <AdminDateFilter
            inline
            label="Thời gian"
            from={from}
            to={to}
            preset={preset}
            onApply={onDateApply}
          />
        </div>
      </div>
      <div className="admin-stat-cards-section">
        <OverviewStatGrid
          items={overviewItems}
          loading={loading}
          periodDays={periodDays}
          columns={4}
          className="admin-dashboard-overview-stat-grid"
        />
      </div>
    </section>
  );
}

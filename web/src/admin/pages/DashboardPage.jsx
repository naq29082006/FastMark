import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Col, Row, Table, Tooltip } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

import {
  getAdminDashboard,
  buildDashboardQuery,
  isDashboardAllTime,
} from '../../api/dashboardApi';
import DashboardSystemOverview from '../components/DashboardSystemOverview';
import DashboardStructureTabsChart from '../components/DashboardStructureTabsChart';
import DashboardTrendTabsChart from '../components/DashboardTrendTabsChart';
import PageContainer, { PanelCard } from '../components/PageContainer';
import ShopCell from '../components/ShopCell';
import PreviewableImage from '../../components/PreviewableImage';
import { useAuth } from '../../context/AuthContext';
import { presetRange } from '../../components/DashboardDateRange';
import { formatCurrency, formatNumber } from '../utils/format';

function chartData(series = []) {
  return (series || []).map((item) => ({
    date: String(item.date || '').slice(5),
    value: Number(item.value) || 0,
  }));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const ORDER_STATUS_PIE_COLORS = {
  inProgress: '#2563eb',
  completed: '#16a34a',
  disputed: '#f59e0b',
  cancelled: '#ef4444',
  other: '#94a3b8',
};

/** Gom trạng thái đơn MongoDB → 4 nhóm dễ đọc trên biểu đồ tròn. */
function buildOrderStatusPieGroups(pieRows = []) {
  const rows = asArray(pieRows);

  const valueForStatuses = (statuses) =>
    statuses.reduce((acc, status) => {
      const row = rows.find((item) => Number(item.status) === status);
      return acc + (Number(row?.value) || 0);
    }, 0);

  const grouped = [
    {
      key: 'inProgress',
      name: 'Đang xử lý',
      value: valueForStatuses([0, 1, 2]),
      color: ORDER_STATUS_PIE_COLORS.inProgress,
    },
    {
      key: 'completed',
      name: 'Hoàn thành',
      value: valueForStatuses([3, 5]),
      color: ORDER_STATUS_PIE_COLORS.completed,
    },
    {
      key: 'disputed',
      name: 'Tranh chấp',
      value: valueForStatuses([4]),
      color: ORDER_STATUS_PIE_COLORS.disputed,
    },
    {
      key: 'cancelled',
      name: 'Đã hủy',
      value: valueForStatuses([6, 7]),
      color: ORDER_STATUS_PIE_COLORS.cancelled,
    },
  ].filter((item) => item.value > 0);

  const groupedTotal = grouped.reduce((sum, item) => sum + item.value, 0);
  const rawTotal = rows.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  if (groupedTotal > 0) {
    return {
      segments: grouped.map((item) => ({
        ...item,
        percent: groupedTotal ? (item.value / groupedTotal) * 100 : 0,
      })),
      total: groupedTotal,
    };
  }

  const fallback = rows
    .filter((item) => Number(item.value) > 0)
    .map((item, index) => ({
      key: `status-${item.status}`,
      name: item.label || `Trạng thái ${item.status}`,
      value: Number(item.value) || 0,
      color: Object.values(ORDER_STATUS_PIE_COLORS)[index % 5] || ORDER_STATUS_PIE_COLORS.other,
    }));

  const total = fallback.reduce((sum, item) => sum + item.value, 0);
  return {
    segments: fallback.map((item) => ({
      ...item,
      percent: total ? (item.value / total) * 100 : 0,
    })),
    total: total || rawTotal,
  };
}

/** Doanh thu gói bán lũy kế: gói Seller + Banner. */
function buildRevenueStructurePie(cards = {}) {
  const seller = Number(cards.sellerPlanRevenueAllTime) || 0;
  const banner = Number(cards.bannerPlanRevenueAllTime) || 0;
  const total =
    Number(cards.packageRevenueAllTime) || seller + banner;

  const allSegments = [
    { key: 'seller', name: 'Gói Seller', value: seller, color: '#7c3aed' },
    { key: 'banner', name: 'Gói Banner', value: banner, color: '#16a34a' },
  ].map((item) => ({
    ...item,
    percent: total ? (item.value / total) * 100 : 0,
  }));

  return {
    segments: allSegments.filter((item) => item.value > 0),
    legendSegments: allSegments,
    total,
  };
}

function dashboardProductCell(name, thumbnail) {
  const label = name || '—';
  return (
    <div className="admin-dashboard-product-cell">
      <PreviewableImage
        src={thumbnail}
        alt={label}
        width={32}
        height={32}
        shape="rounded"
        fallbackLetter={label}
        className="admin-dashboard-product-cell-thumb"
      />
      <span className="admin-dashboard-product-cell-name" title={label}>
        {label}
      </span>
    </div>
  );
}

function dashboardSttColumn() {
  return {
    title: 'STT',
    key: 'stt',
    width: 44,
    align: 'center',
    render: (_value, _record, index) => index + 1,
  };
}

function dashboardViewColumn(navigate, getPath, title) {
  return {
    title: '',
    key: 'view',
    width: 40,
    align: 'center',
    render: (_, row) => {
      const path = getPath(row);
      if (!path) return null;
      return (
        <Tooltip title={title}>
          <Button
            type="text"
            size="small"
            className="admin-dashboard-rank-view-btn"
            icon={<EyeOutlined />}
            aria-label={title}
            onClick={() => navigate(path)}
          />
        </Tooltip>
      );
    },
  };
}

export default function DashboardPage() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const initialRange = useMemo(() => presetRange('30days'), []);
  const [preset, setPreset] = useState('30days');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const isAllTime = preset === 'all' || isDashboardAllTime(from, to);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      }
      const params =
        preset === 'all' || isDashboardAllTime(from, to)
          ? { range: 'all' }
          : buildDashboardQuery(from, to);
      const dashboard = await getAdminDashboard(token, params);
      if (!dashboard) {
        throw new Error('Backend không trả về dữ liệu dashboard.');
      }
      setData(dashboard);
    } catch (err) {
      setError(err.message || 'Không tải được dashboard.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, from, to, preset]);

  useEffect(() => {
    if (!isAllTime && (!from || !to)) {
      return;
    }
    load();
  }, [load, isAllTime, from, to]);

  const cards = data?.cards || {};
  const charts = data?.charts || {};
  const rankings = data?.rankings || {};

  const chartSeries = useMemo(
    () => [
      { key: 'users', data: chartData(charts.usersOverTime), color: '#16a34a' },
      { key: 'sellers', data: chartData(charts.sellersOverTime), color: '#2563eb' },
      { key: 'reservations', data: chartData(charts.reservationsOverTime), color: '#f59e0b' },
      { key: 'revenue', data: chartData(charts.revenueOverTime), color: '#7c3aed', isCurrency: true },
    ],
    [charts]
  );

  const orderStatusPie = useMemo(
    () => buildOrderStatusPieGroups(charts.reservationStatusPie),
    [charts.reservationStatusPie]
  );

  const revenueStructurePie = useMemo(
    () =>
      isAllTime
        ? buildRevenueStructurePie(cards)
        : buildRevenueStructurePie({
            sellerPlanRevenueAllTime: cards.sellerPlanRevenueInRange,
            bannerPlanRevenueAllTime: cards.bannerPlanRevenueInRange,
            packageRevenueAllTime:
              (Number(cards.sellerPlanRevenueInRange) || 0) +
              (Number(cards.bannerPlanRevenueInRange) || 0),
          }),
    [cards, isAllTime]
  );

  const topShopsByRevenue = asArray(rankings.topSellingShops).map((row) => ({
    shopId: row.shopId,
    shopName: row.shopName,
    shopUsername: row.shopUsername,
    avatar: row.avatar,
    revenue: row.revenue,
    orderCount: row.orders,
  }));

  const topProducts = asArray(rankings.topSellingProducts).map((row) => ({
    productId: row.productId,
    productName: row.name,
    thumbnail: row.thumbnail,
    count: row.soldQuantity,
    revenue: row.revenue,
  }));

  const topReportedShops = asArray(rankings.topReportedShops).map((row) => ({
    shopId: row.shopId,
    shopName: row.shopName,
    shopUsername: row.shopUsername,
    avatar: row.avatar,
    reportCount: row.reportCount,
  }));

  return (
    <PageContainer subtitle="Dashboard FastMark">
      {error ? (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} action={<a onClick={load}>Thử lại</a>} />
      ) : null}

      <DashboardSystemOverview
        loading={loading}
        cards={cards}
        metrics={data?.metrics}
        previousPeriod={data?.previousPeriod}
        periodDays={data?.periodDays}
        isAllTime={isAllTime}
        from={from}
        to={to}
        preset={preset}
        onDateApply={(range) => {
          setPreset(range.preset);
          setFrom(range.from);
          setTo(range.to);
        }}
      />

      <Row gutter={[12, 12]} className="admin-dashboard-charts-row" style={{ marginTop: 8 }} align="stretch">
        <Col xs={24} flex="2.75 2.75 320px">
          <PanelCard className="admin-dashboard-trend-panel">
            <DashboardTrendTabsChart series={chartSeries} loading={loading} />
          </PanelCard>
        </Col>
        <Col xs={24} flex="0.95 0.95 220px">
          <PanelCard className="admin-dashboard-trend-panel admin-dashboard-structure-panel">
            <DashboardStructureTabsChart
              loading={loading}
              orderStatus={orderStatusPie}
              revenueStructure={revenueStructurePie}
            />
          </PanelCard>
        </Col>
      </Row>

      <Row gutter={[12, 12]} className="admin-dashboard-rank-row" style={{ marginTop: 12 }} align="stretch">
        <Col xs={24} lg={12} xl={8}>
          <PanelCard className="admin-dashboard-rank-panel" title="Top 10 shop doanh thu">
            <div className="admin-dashboard-rank-panel-body">
            <Table
              className="admin-dashboard-rank-table"
              size="small"
              pagination={false}
              loading={loading}
              tableLayout="fixed"
              rowKey={(r) => r.shopId || r.id || r._id}
              dataSource={topShopsByRevenue.slice(0, 10)}
              locale={{ emptyText: 'Chưa có dữ liệu' }}
              columns={[
                dashboardSttColumn(),
                {
                  title: 'Shop',
                  key: 'shop',
                  render: (_, row) => (
                    <ShopCell
                      shopName={row.shopName}
                      shopUsername={row.shopUsername}
                      shopAvatar={row.avatar}
                    />
                  ),
                },
                {
                  title: 'Doanh thu',
                  dataIndex: 'revenue',
                  key: 'revenue',
                  render: formatCurrency,
                  width: 96,
                  align: 'right',
                },
                {
                  title: 'Đơn',
                  dataIndex: 'orderCount',
                  key: 'orderCount',
                  render: formatNumber,
                  width: 52,
                  align: 'right',
                },
                dashboardViewColumn(
                  navigate,
                  (row) => (row.shopId ? `/sellers/shops/${row.shopId}` : null),
                  'Xem shop'
                ),
              ]}
            />
            </div>
          </PanelCard>
        </Col>
        <Col xs={24} lg={12} xl={8}>
          <PanelCard className="admin-dashboard-rank-panel" title="Top 10 sản phẩm">
            <div className="admin-dashboard-rank-panel-body">
            <Table
              className="admin-dashboard-rank-table admin-dashboard-rank-table--products"
              size="small"
              pagination={false}
              loading={loading}
              tableLayout="fixed"
              rowKey={(r) => r.productId || r.id || r._id}
              dataSource={topProducts.slice(0, 10)}
              locale={{ emptyText: 'Chưa có' }}
              columns={[
                dashboardSttColumn(),
                {
                  title: 'Sản phẩm',
                  key: 'product',
                  render: (_, row) => dashboardProductCell(row.productName, row.thumbnail),
                },
                {
                  title: 'Đã bán',
                  dataIndex: 'count',
                  key: 'count',
                  render: formatNumber,
                  width: 64,
                  align: 'right',
                },
                dashboardViewColumn(
                  navigate,
                  (row) => (row.productId ? `/products/${row.productId}` : null),
                  'Xem sản phẩm'
                ),
              ]}
            />
            </div>
          </PanelCard>
        </Col>
        <Col xs={24} lg={12} xl={8}>
          <PanelCard className="admin-dashboard-rank-panel" title="Top 10 shop bị báo cáo">
            <div className="admin-dashboard-rank-panel-body">
            <Table
              className="admin-dashboard-rank-table"
              size="small"
              pagination={false}
              loading={loading}
              tableLayout="fixed"
              rowKey={(r) => r.shopId || r.id || r._id}
              dataSource={topReportedShops.slice(0, 10)}
              locale={{ emptyText: 'Chưa có dữ liệu' }}
              columns={[
                dashboardSttColumn(),
                {
                  title: 'Shop',
                  key: 'shop',
                  render: (_, row) => (
                    <ShopCell
                      shopName={row.shopName}
                      shopUsername={row.shopUsername}
                      shopAvatar={row.avatar}
                    />
                  ),
                },
                {
                  title: 'Báo cáo',
                  dataIndex: 'reportCount',
                  key: 'reportCount',
                  render: formatNumber,
                  width: 72,
                  align: 'right',
                },
                dashboardViewColumn(
                  navigate,
                  (row) => (row.shopId ? `/sellers/shops/${row.shopId}` : null),
                  'Xem shop'
                ),
              ]}
            />
            </div>
          </PanelCard>
        </Col>
      </Row>
    </PageContainer>
  );
}

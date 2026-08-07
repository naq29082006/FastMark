import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Col, Empty, Row, Table, Tooltip } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  buildDashboardQuery,
  formatDashboardPeriodLabel,
  getAdminDashboard,
} from '../../api/dashboardApi';
import { presetDates } from '../../components/DashboardDateRange';
import DashboardSystemOverview from '../components/DashboardSystemOverview';
import DashboardPendingActions from '../components/DashboardPendingActions';
import PageContainer, { PanelCard } from '../components/PageContainer';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatNumber } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';

function formatDateDisplay(value) {
  const [year, month, day] = String(value || '').split('-');
  if (!year || !month || !day) return '';
  return `${day}-${month}-${year}`;
}

function periodSummary(from, to) {
  if (!from || !to) {
    return { label: 'tất cả thời gian', shortLabel: 'tất cả' };
  }
  const label = formatDashboardPeriodLabel(from, to, formatDateDisplay);
  const start = new Date(from);
  const end = new Date(to);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return {
    label,
    shortLabel: from === to ? '1 ngày' : `${days} ngày`,
  };
}

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

function pieTooltipFormatter(value, name, props) {
  const payload = props?.payload;
  const pct = payload?.percent != null ? ` (${payload.percent.toFixed(1)}%)` : '';
  return [`${formatNumber(value)} đơn${pct}`, name];
}

function dashboardViewColumn(navigate, getPath, title) {
  return {
    title: '',
    key: 'view',
    width: 44,
    align: 'center',
    fixed: 'right',
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
  const defaultRange = useMemo(() => presetDates(30), []);
  const [preset, setPreset] = useState('30days');
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const period = useMemo(() => periodSummary(from, to), [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      }
      const dashboard = await getAdminDashboard(token, buildDashboardQuery(from, to));
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
  }, [getIdToken, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = data?.cards || {};
  const charts = data?.charts || {};
  const rankings = data?.rankings || {};
  const pending = data?.pending || {};

  const chartSeries = [
    { key: 'users', title: 'Người dùng mới', data: chartData(charts.usersOverTime), color: '#16a34a' },
    { key: 'sellers', title: 'Gian hàng mới', data: chartData(charts.sellersOverTime), color: '#2563eb' },
    { key: 'reservations', title: 'Đơn hàng', data: chartData(charts.reservationsOverTime), color: '#f59e0b' },
    { key: 'revenue', title: 'Doanh thu', data: chartData(charts.revenueOverTime), color: '#7c3aed' },
  ];

  const orderStatusPie = useMemo(
    () => buildOrderStatusPieGroups(charts.reservationStatusPie),
    [charts.reservationStatusPie]
  );

  const topShopsByRevenue = asArray(rankings.topSellingShops).map((row) => ({
    shopId: row.shopId,
    shopName: row.shopName,
    revenue: row.revenue,
    orderCount: row.orders,
  }));

  const topProducts = asArray(rankings.topSellingProducts).map((row) => ({
    productId: row.productId,
    productName: row.name,
    count: row.soldQuantity,
    revenue: row.revenue,
  }));

  return (
    <PageContainer subtitle={`Dashboard FastMark — ${period.label}`}>
      {error ? (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} action={<a onClick={load}>Thử lại</a>} />
      ) : null}

      <DashboardSystemOverview
        loading={loading}
        from={from}
        to={to}
        preset={preset}
        onApply={(range) => {
          setPreset(range.preset);
          setFrom(range.from);
          setTo(range.to);
        }}
        periodDays={data?.periodDays}
        cards={cards}
        metrics={data?.metrics}
        previousPeriod={data?.previousPeriod}
      />

      <DashboardPendingActions loading={loading} pending={pending} />

      <Row gutter={[16, 16]} className="admin-dashboard-rank-row" style={{ marginTop: 8 }} align="stretch">
        <Col xs={24} lg={7} xl={7}>
          <PanelCard className="admin-dashboard-pie-panel admin-dashboard-rank-panel" title="Cơ cấu trạng thái đơn">
            <div className="admin-dashboard-rank-panel-body">
            <p className="admin-dashboard-pie-note admin-dashboard-pie-note--compact">
              {formatNumber(orderStatusPie.total || cards.totalReservations || 0)} đơn (toàn hệ thống)
            </p>
            <div className="admin-dashboard-pie-chart">
              {loading ? (
                <Empty description="Đang tải..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : orderStatusPie.segments.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusPie.segments}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={76}
                      paddingAngle={2}
                    >
                      {orderStatusPie.segments.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={pieTooltipFormatter} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="Chưa có đơn" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
            {!loading && orderStatusPie.segments.length ? (
              <ul className="admin-dashboard-pie-legend-list admin-dashboard-pie-legend-list--compact">
                {orderStatusPie.segments.map((row) => (
                  <li key={row.key}>
                    <span className="admin-dashboard-pie-swatch" style={{ background: row.color }} />
                    <span className="admin-dashboard-pie-legend-name">{row.name}</span>
                    <span className="admin-dashboard-pie-legend-meta">
                      {formatNumber(row.value)} · {row.percent.toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            </div>
          </PanelCard>
        </Col>
        <Col xs={24} lg={9} xl={9}>
          <PanelCard className="admin-dashboard-rank-panel" title="Top 10 shop doanh thu">
            <div className="admin-dashboard-rank-panel-body">
            <Table
              className="admin-dashboard-rank-table"
              size="small"
              pagination={false}
              loading={loading}
              scroll={{ x: 320 }}
              rowKey={(r) => r.shopId || r.id || r._id}
              dataSource={topShopsByRevenue.slice(0, 10)}
              locale={{ emptyText: 'Chưa có dữ liệu' }}
              columns={[
                buildSttColumn({ page: 1, pageSize: 1 }),
                { title: 'Shop', dataIndex: 'shopName', key: 'shopName', ellipsis: true, width: 100 },
                {
                  title: 'Doanh thu',
                  dataIndex: 'revenue',
                  key: 'revenue',
                  render: formatCurrency,
                  width: 108,
                  align: 'right',
                },
                {
                  title: 'Đơn',
                  dataIndex: 'orderCount',
                  key: 'orderCount',
                  render: formatNumber,
                  width: 48,
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
        <Col xs={24} lg={8} xl={8}>
          <PanelCard className="admin-dashboard-rank-panel" title="Top 10 sản phẩm">
            <div className="admin-dashboard-rank-panel-body">
            <Table
              className="admin-dashboard-rank-table admin-dashboard-rank-table--products"
              size="small"
              pagination={false}
              loading={loading}
              rowKey={(r) => r.productId || r.id || r._id}
              dataSource={topProducts.slice(0, 10)}
              locale={{ emptyText: 'Chưa có' }}
              columns={[
                buildSttColumn({ page: 1, pageSize: 1 }),
                { title: 'Sản phẩm', dataIndex: 'productName', key: 'productName', ellipsis: true },
                {
                  title: 'Đã bán',
                  dataIndex: 'count',
                  key: 'count',
                  render: formatNumber,
                  width: 56,
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
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 8 }}>
        {chartSeries.map((chart) => (
          <Col key={chart.key} xs={24} lg={12}>
            <PanelCard title={chart.title}>
              <div style={{ width: '100%', height: 260 }}>
                {chart.data.length ? (
                  <ResponsiveContainer>
                    <AreaChart data={chart.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(v) => formatNumber(v)} />
                      <ChartTooltip formatter={(v) => formatNumber(v)} />
                      <Area type="monotone" dataKey="value" stroke={chart.color} fill={chart.color} fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="Chưa có dữ liệu" style={{ paddingTop: 72 }} />
                )}
              </div>
            </PanelCard>
          </Col>
        ))}
      </Row>
    </PageContainer>
  );
}

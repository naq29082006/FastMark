import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Row } from 'antd';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getAdminDashboard } from '../../api/dashboardApi';
import PageContainer, { PanelCard } from '../components/PageContainer';
import StatCards from '../components/StatCards';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatNumber } from '../utils/format';

function chartData(series = []) {
  return (series || []).map((item) => ({
    date: String(item.date || '').slice(5),
    value: Number(item.value) || 0,
  }));
}

function ChartPlaceholder({ title, data, color = '#16a34a', loading }) {
  return (
    <PanelCard title={title}>
      {loading ? (
        <div style={{ height: 260, display: 'grid', placeItems: 'center' }}>Đang tải...</div>
      ) : data?.length ? (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(v) => formatNumber(v)} />
              <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty description="Chưa có dữ liệu biểu đồ" style={{ padding: '48px 0' }} />
      )}
    </PanelCard>
  );
}

export default function AnalyticsPage() {
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Phiên đăng nhập hết hạn.');
      const dashboard = await getAdminDashboard(token, { range: '30days' });
      if (!dashboard) throw new Error('Không có dữ liệu dashboard.');
      setData(dashboard);
    } catch (err) {
      setError(err.message || 'Không tải được thống kê.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = data?.cards || {};
  const charts = data?.charts || {};
  const rankings = data?.rankings || {};

  const statItems = useMemo(
    () => [
      { key: 'users', title: 'Người dùng', value: cards.totalUsers },
      { key: 'shops', title: 'Gian hàng', value: cards.totalShops },
      { key: 'products', title: 'Sản phẩm', value: cards.tongSP },
      { key: 'reservations', title: 'Tổng đơn hàng', value: cards.totalReservations },
      {
        key: 'disputes',
        title: 'Khiếu nại',
        value: (charts.reservationStatusPie || []).find((r) => Number(r.status) === 4)?.value || 0,
      },
      {
        key: 'revenue',
        title: 'Doanh thu (30 ngày)',
        value: cards.periodRevenue,
        isCurrency: true,
      },
      {
        key: 'wallet',
        title: 'Ví hệ thống',
        value: cards.escrowBalance,
        isCurrency: true,
      },
    ],
    [cards, charts.reservationStatusPie]
  );

  const chartDefs = [
    { key: 'users', title: 'Người dùng mới (30 ngày)', data: chartData(charts.usersOverTime), color: '#16a34a' },
    { key: 'sellers', title: 'Người bán mới (30 ngày)', data: chartData(charts.sellersOverTime), color: '#2563eb' },
    { key: 'reservations', title: 'Đơn hàng (30 ngày)', data: chartData(charts.reservationsOverTime), color: '#f59e0b' },
    { key: 'revenue', title: 'Doanh thu (30 ngày)', data: chartData(charts.revenueOverTime), color: '#7c3aed' },
  ];

  const topShopsByRevenue = rankings.topSellingShops || [];
  const topProducts = rankings.topSellingProducts || [];

  return (
    <PageContainer title="Thống kê" subtitle="Phân tích hệ thống — 30 ngày gần nhất">
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <StatCards items={statItems} loading={loading} columns={4} />

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {chartDefs.map((chart) => (
          <Col key={chart.key} xs={24} lg={12}>
            <ChartPlaceholder title={chart.title} data={chart.data} color={chart.color} loading={loading} />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} md={8}>
          <Card size="small" title="Top shop doanh thu" loading={loading}>
            {topShopsByRevenue.slice(0, 5).map((row) => (
              <div key={row.shopId || row.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{row.shopName || '—'}</span>
                <strong>{formatCurrency(row.revenue)}</strong>
              </div>
            ))}
            {!topShopsByRevenue.length && !loading ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="Top shop nhiều đơn" loading={loading}>
            {[...topShopsByRevenue]
              .sort((a, b) => (b.orders || 0) - (a.orders || 0))
              .slice(0, 5)
              .map((row) => (
                <div key={row.shopId || row.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span>{row.shopName || '—'}</span>
                  <strong>{formatNumber(row.orders)}</strong>
                </div>
              ))}
            {!topShopsByRevenue.length && !loading ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="Top sản phẩm bán chạy" loading={loading}>
            {topProducts.slice(0, 5).map((row) => (
              <div key={row.productId || row.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{row.name || '—'}</span>
                <strong>{formatNumber(row.soldQuantity)}</strong>
              </div>
            ))}
            {!topProducts.length && !loading ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}

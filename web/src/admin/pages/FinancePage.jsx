import { useCallback, useEffect, useState } from 'react';
import { Alert, Col, Row } from 'antd';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getFinanceOverview } from '../../api/accountApi';
import PageContainer, { PanelCard } from '../components/PageContainer';
import StatCards from '../components/StatCards';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatNumber } from '../utils/format';

export default function FinancePage() {
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getFinanceOverview(token, { detailType: 'topup' });
      setData(payload.data || payload);
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu tài chính');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary || {};
  const charts = data?.charts || {};

  const stats = [
    { key: 'rev-plan', title: 'Doanh thu nền tảng', value: formatCurrency(summary.platformRevenue ?? summary.subscriptionRevenue) },
    { key: 'rev-banner', title: 'Doanh thu banner', value: formatCurrency(summary.bannerRevenue) },
    { key: 'deposit', title: 'Tổng tiền cọc', value: formatCurrency(summary.depositHoldTotal) },
    { key: 'refund', title: 'Tổng tiền hoàn', value: formatCurrency(summary.depositRefundTotal) },
    { key: 'withdraw', title: 'Tổng tiền rút', value: formatCurrency(summary.withdrawTotal) },
    { key: 'in', title: 'Tổng tiền vào', value: formatCurrency(summary.topupTotal) },
  ];

  return (
    <PageContainer title="Tài chính hệ thống" subtitle="WalletTransaction · WithdrawRequest · SellerSubscription · Banner">
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
      <StatCards items={stats} loading={loading} columns={3} />
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {[
          { title: 'Nạp tiền theo ngày', data: charts.topupSeries || [], color: '#16a34a' },
          { title: 'Rút tiền theo ngày', data: charts.withdrawSeries || [], color: '#ef4444' },
          { title: 'Giải ngân cọc', data: charts.depositReleaseSeries || [], color: '#2563eb' },
        ].map((chart) => (
          <Col key={chart.title} xs={24} lg={8}>
            <PanelCard title={chart.title}>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <AreaChart data={(chart.data || []).map((d) => ({ date: String(d.date || '').slice(5), value: d.value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="value" stroke={chart.color} fill={chart.color} fillOpacity={0.12} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </PanelCard>
          </Col>
        ))}
      </Row>
    </PageContainer>
  );
}

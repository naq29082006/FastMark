import { useMemo, useState } from 'react';
import { Empty, Skeleton } from 'antd';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCurrency, formatNumber } from '../utils/format';

const USER_LINE = { dataKey: 'users', name: 'Người dùng mới', color: '#16a34a' };
const SHOP_LINE = { dataKey: 'shops', name: 'Gian hàng mới', color: '#2563eb' };

function mergeUsersAndShopsSeries(usersData = [], shopsData = []) {
  const map = new Map();
  for (const row of usersData) {
    map.set(row.date, {
      date: row.date,
      users: Number(row.value) || 0,
      shops: 0,
    });
  }
  for (const row of shopsData) {
    const current = map.get(row.date) || { date: row.date, users: 0, shops: 0 };
    current.shops = Number(row.value) || 0;
    map.set(row.date, current);
  }
  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function formatAxisValue(value, isCurrency) {
  const n = Number(value) || 0;
  if (isCurrency) {
    if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
    if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
    return formatNumber(n);
  }
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return formatNumber(n);
}

export default function DashboardTrendTabsChart({ series = [], loading = false }) {
  const byKey = useMemo(() => new Map(series.map((item) => [item.key, item])), [series]);

  const tabs = useMemo(() => {
    const users = byKey.get('users')?.data || [];
    const sellers = byKey.get('sellers')?.data || [];
    const accountsData = mergeUsersAndShopsSeries(users, sellers);

    return [
      {
        key: 'accounts',
        tabLabel: 'Người dùng',
        title: 'Người dùng & Gian hàng mới',
        isCurrency: false,
        mode: 'multiLine',
        data: accountsData,
        lines: [USER_LINE, SHOP_LINE],
      },
      {
        key: 'reservations',
        tabLabel: 'Đơn hàng',
        title: 'Đơn hàng mới',
        isCurrency: false,
        mode: 'area',
        data: byKey.get('reservations')?.data || [],
        color: byKey.get('reservations')?.color || '#f59e0b',
      },
      {
        key: 'revenue',
        tabLabel: 'Doanh thu',
        title: 'Doanh thu',
        isCurrency: true,
        mode: 'area',
        data: byKey.get('revenue')?.data || [],
        color: byKey.get('revenue')?.color || '#7c3aed',
      },
    ];
  }, [byKey]);

  const [activeKey, setActiveKey] = useState('accounts');
  const active = tabs.find((item) => item.key === activeKey) || tabs[0];
  const gradientId = `admin-trend-fill-${active.key}`;
  const hasData =
    active.mode === 'multiLine'
      ? active.data.some((row) => row.users > 0 || row.shops > 0)
      : active.data?.length > 0;

  return (
    <div className="admin-dashboard-trend-panel-inner">
      <div className="admin-dashboard-trend-head">
        <div className="admin-dashboard-trend-head-text">
          <h2 className="admin-dashboard-trend-title">{active.title}</h2>
        </div>
        <div className="admin-dashboard-trend-segment" role="tablist" aria-label="Chọn biểu đồ">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={item.key === active.key}
              className={
                item.key === active.key
                  ? 'admin-dashboard-trend-segment-btn active'
                  : 'admin-dashboard-trend-segment-btn'
              }
              onClick={() => setActiveKey(item.key)}
            >
              {item.tabLabel}
            </button>
          ))}
        </div>
      </div>

      {active.mode === 'multiLine' && !loading && hasData ? (
        <ul className="admin-dashboard-trend-legend" aria-hidden="true">
          {active.lines.map((line) => (
            <li key={line.dataKey}>
              <span className="admin-dashboard-trend-legend-line" style={{ background: line.color }} />
              {line.name}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="admin-dashboard-trend-chart">
        {loading ? (
          <Skeleton active paragraph={false} title={false} className="admin-dashboard-trend-skeleton" />
        ) : hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {active.mode === 'multiLine' ? (
              <LineChart data={active.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={(v) => formatAxisValue(v, false)}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <ChartTooltip
                  formatter={(value, name) => [formatNumber(value), name]}
                  labelFormatter={(label) => `Ngày ${label}`}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                {active.lines.map((line) => (
                  <Line
                    key={line.dataKey}
                    type="monotone"
                    dataKey={line.dataKey}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            ) : (
              <AreaChart data={active.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={active.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={active.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={(v) => formatAxisValue(v, active.isCurrency)}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <ChartTooltip
                  formatter={(value) => [
                    active.isCurrency ? formatCurrency(value) : formatNumber(value),
                    active.title,
                  ]}
                  labelFormatter={(label) => `Ngày ${label}`}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={active.color}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <Empty description="Chưa có dữ liệu" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Empty, Skeleton } from 'antd';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';

import { formatCurrency, formatNumber, formatPercent } from '../utils/format';

function pieTooltipOrders(value, name, props) {
  const payload = props?.payload;
  const pct = payload?.percent != null ? ` (${formatPercent(payload.percent)})` : '';
  return [`${formatNumber(value)} đơn${pct}`, name];
}

function pieTooltipRevenue(value, name, props) {
  const payload = props?.payload;
  const pct = payload?.percent != null ? ` (${formatPercent(payload.percent)})` : '';
  return [`${formatCurrency(value)}${pct}`, name];
}

export default function DashboardStructureTabsChart({
  loading = false,
  orderStatus = { segments: [], total: 0 },
  revenueStructure = { segments: [], legendSegments: [], total: 0 },
}) {
  const tabs = useMemo(
    () => [
      {
        key: 'orders',
        tabLabel: 'Đơn hàng',
        title: 'Cơ cấu trạng thái đơn',
        note: `${formatNumber(orderStatus.total || 0)} đơn (toàn hệ thống)`,
        segments: orderStatus.segments || [],
        legendRows: orderStatus.segments || [],
        emptyDescription: 'Chưa có đơn',
        tooltipFormatter: pieTooltipOrders,
        formatLegendValue: (v) => formatNumber(v),
      },
      {
        key: 'revenue',
        tabLabel: 'Doanh thu',
        title: 'Cơ cấu doanh thu',
        note: `${formatCurrency(revenueStructure.total || 0)} (toàn hệ thống)`,
        segments: revenueStructure.segments || [],
        legendRows: revenueStructure.legendSegments || revenueStructure.segments || [],
        emptyDescription: 'Chưa có doanh thu',
        tooltipFormatter: pieTooltipRevenue,
        formatLegendValue: (v) => formatCurrency(v),
      },
    ],
    [orderStatus, revenueStructure]
  );

  const [activeKey, setActiveKey] = useState('orders');
  const active = tabs.find((t) => t.key === activeKey) || tabs[0];

  return (
    <div className="admin-dashboard-trend-panel-inner admin-dashboard-structure-tabs-inner">
      <div className="admin-dashboard-trend-head admin-dashboard-trend-head--structure">
        <div className="admin-dashboard-trend-head-text">
          <h2 className="admin-dashboard-trend-title">{active.title}</h2>
          <p className="admin-dashboard-trend-sub">{active.note}</p>
        </div>
        <div
          className="admin-dashboard-trend-segment admin-dashboard-trend-segment--compact"
          role="tablist"
          aria-label="Cơ cấu"
        >
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

      <div className="admin-dashboard-structure-body">
        {loading ? (
          <Skeleton active paragraph={false} title={false} className="admin-dashboard-trend-skeleton" />
        ) : (
          <>
            <div className="admin-dashboard-pie-chart admin-dashboard-pie-chart--tabbed">
              {active.segments.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={active.segments}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="88%"
                      paddingAngle={active.segments.length > 1 ? 2 : 0}
                    >
                      {active.segments.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={active.tooltipFormatter} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description={active.emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
            {!loading && active.legendRows.length ? (
              <ul className="admin-dashboard-pie-legend-list admin-dashboard-pie-legend-list--compact admin-dashboard-pie-legend-list--tabbed">
                {active.legendRows.map((row) => (
                  <li key={row.key}>
                    <span className="admin-dashboard-pie-swatch" style={{ background: row.color }} />
                    <span className="admin-dashboard-pie-legend-name">{row.name}</span>
                    <span className="admin-dashboard-pie-legend-meta">
                      {active.formatLegendValue(row.value)} · {formatPercent(row.percent)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

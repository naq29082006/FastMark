import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  CircleCheck,
  CircleX,
  Clock,
  Flag,
  Image,
  Minus,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';

import FastMarkShopPinIcon from '../components/icons/FastMarkShopPinIcon';
import DashboardDateRange, { presetDates } from '../components/DashboardDateRange';
import { useAuth } from '../context/AuthContext';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { keepIfSame } from '../utils/realtimeList';
import PreviewableImage from '../components/PreviewableImage';

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

function formatCurrency(value) {
  return `${formatNumber(value)} ₫`;
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 1,
  }).format(Math.abs(value))}%`;
}

function TrendBadge({ current, previous }) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  // Kỳ trước = 0: quy ước tăng 100% nếu có phát sinh mới.
  const percent = prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;
  if (percent > 0) {
    return (
      <small className="trend-badge trend-up">
        <TrendingUp size={12} strokeWidth={2.5} aria-hidden="true" />
        +{formatPercent(percent)}
      </small>
    );
  }
  if (percent < 0) {
    return (
      <small className="trend-badge trend-down">
        <TrendingDown size={12} strokeWidth={2.5} aria-hidden="true" />
        -{formatPercent(percent)}
      </small>
    );
  }
  return (
    <small className="trend-badge trend-flat">
      <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
      0%
    </small>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'green',
  current,
  previous,
  hasTrend = false,
  active = false,
  onClick,
}) {
  const Tag = onClick ? 'button' : 'article';
  function handleClick(event) {
    onClick?.(event);
    if (onClick) {
      event.currentTarget.blur();
    }
  }
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick ? handleClick : undefined}
      className={`dashboard-metric tone-${tone}${onClick ? ' clickable' : ''}${active ? ' active' : ''}`}
    >
      <div className="dashboard-metric-head">
        <div className={`dashboard-metric-icon tone-${tone}`}>
          {Icon ? <Icon size={18} strokeWidth={2} aria-hidden="true" /> : null}
        </div>
        <div className="dashboard-metric-body">
          <span className="dashboard-metric-label">{label}</span>
          <div className="dashboard-metric-value">
            <strong>{value}</strong>
            {hasTrend ? <TrendBadge current={current} previous={previous} /> : null}
          </div>
          {detail ? <small className="dashboard-metric-detail">{detail}</small> : null}
        </div>
      </div>
    </Tag>
  );
}

function formatChartDate(dateKey) {
  const [, month, day] = String(dateKey || '').split('-');
  return month && day ? `${day}-${month}` : dateKey;
}

function formatCompactNumber(value) {
  const num = Number(value) || 0;
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}tỷ`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}tr`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
  return formatNumber(num);
}

function AreaChart({ data = [], color = '#ee4d2d', isCurrency = false }) {
  const width = 960;
  const height = 160;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 34;
  const [hovered, setHovered] = useState(null);

  const max = Math.max(...data.map((item) => Number(item.value) || 0), 1);
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const coords = data.map((item, index) => ({
    x: padLeft + index * stepX,
    y: padTop + innerH - ((Number(item.value) || 0) / max) * innerH,
  }));
  const linePoints = coords.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = coords.length
    ? `${padLeft},${padTop + innerH} ${linePoints} ${coords[coords.length - 1].x},${padTop + innerH}`
    : '';

  // Nhãn trục X: tối đa ~12 mốc để không dính chữ.
  const labelStep = Math.max(1, Math.ceil(data.length / 12));

  // Mốc trục Y: với số đếm thì chỉ dùng số nguyên để không bị lặp nhãn (0,1,1,2,2).
  let yTicks;
  if (isCurrency) {
    yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      ratio,
      label: formatCompactNumber(max * ratio),
    }));
  } else {
    const step = Math.max(1, Math.ceil(max / 4));
    yTicks = [];
    for (let value = 0; value <= max; value += step) {
      yTicks.push({ ratio: value / max, label: formatNumber(value) });
    }
    if (yTicks[yTicks.length - 1].ratio < 1) {
      yTicks.push({ ratio: 1, label: formatNumber(max) });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="chart-svg"
      role="img"
      onMouseLeave={() => setHovered(null)}
    >
      {yTicks.map(({ ratio, label }) => {
        const y = padTop + innerH - ratio * innerH;
        return (
          <g key={ratio}>
            <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#eef2f7" />
            <text x={padLeft - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
              {label}
            </text>
          </g>
        );
      })}
      {areaPoints ? <polygon points={areaPoints} fill={color} opacity="0.12" /> : null}
      <polyline fill="none" stroke={color} strokeWidth="2.5" points={linePoints} />
      {data.map((item, index) => {
        const { x, y } = coords[index];
        return (
          <g key={`${item.date}-${index}`}>
            <rect
              x={x - stepX / 2}
              y={padTop}
              width={Math.max(stepX, 8)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
            />
            <circle cx={x} cy={y} r={hovered === index ? 5 : 3} fill={color} />
            {index % labelStep === 0 || index === data.length - 1 ? (
              <text x={x} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                {formatChartDate(item.date)}
              </text>
            ) : null}
          </g>
        );
      })}
      {hovered != null && coords[hovered] ? (
        <g>
          <rect
            x={Math.min(Math.max(coords[hovered].x - 56, padLeft), width - padRight - 112)}
            y={Math.max(coords[hovered].y - 42, 2)}
            width="112"
            height="34"
            rx="6"
            fill="#0f172a"
            opacity="0.92"
          />
          <text
            x={Math.min(Math.max(coords[hovered].x, padLeft + 56), width - padRight - 56)}
            y={Math.max(coords[hovered].y - 28, 16)}
            textAnchor="middle"
            fontSize="10"
            fill="#cbd5e1"
          >
            {formatChartDate(data[hovered].date)}
          </text>
          <text
            x={Math.min(Math.max(coords[hovered].x, padLeft + 56), width - padRight - 56)}
            y={Math.max(coords[hovered].y - 14, 30)}
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fill="#ffffff"
          >
            {isCurrency ? formatCurrency(data[hovered].value) : formatNumber(data[hovered].value)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

/** Các ô chỉ số có biểu đồ theo ngày — bấm ô nào thì biểu đồ hiển thị chỉ số đó. */
const METRIC_DEFS = [
  {
    key: 'newUsers',
    label: 'Người dùng mới',
    icon: Users,
    tone: 'green',
    isCurrency: false,
    seriesKey: 'usersOverTime',
  },
  {
    key: 'newSellers',
    label: 'Gian hàng mới',
    icon: FastMarkShopPinIcon,
    tone: 'green',
    isCurrency: false,
    seriesKey: 'sellersOverTime',
  },
  {
    key: 'newProducts',
    label: 'Sản phẩm mới',
    icon: Package,
    tone: 'green',
    isCurrency: false,
    seriesKey: 'productsOverTime',
  },
  {
    key: 'newReservations',
    label: 'Đơn giữ hàng mới',
    icon: ShoppingCart,
    tone: 'orange',
    isCurrency: false,
    seriesKey: 'reservationsOverTime',
  },
  {
    key: 'completedReservations',
    label: 'Đơn hoàn thành',
    icon: CircleCheck,
    tone: 'green',
    isCurrency: false,
    seriesKey: 'completedOverTime',
  },
  {
    key: 'cancelledReservations',
    label: 'Đơn hủy',
    icon: CircleX,
    tone: 'red',
    isCurrency: false,
    seriesKey: 'cancelledOverTime',
  },
  {
    key: 'disputedReservations',
    label: 'Đơn tranh chấp',
    icon: AlertTriangle,
    tone: 'orange',
    isCurrency: false,
    seriesKey: 'disputedOverTime',
  },
  {
    key: 'sellerPlanRevenue',
    label: 'Doanh thu gói Seller',
    icon: Wallet,
    tone: 'green',
    isCurrency: true,
    seriesKey: 'sellerPlanRevenueOverTime',
    detail: (metrics) => `${formatNumber(metrics.sellerPlansSold)} lượt mua`,
  },
  {
    key: 'bannerPlanRevenue',
    label: 'Doanh thu Banner',
    icon: Flag,
    tone: 'purple',
    isCurrency: true,
    seriesKey: 'bannerPlanRevenueOverTime',
    detail: (metrics) => `${formatNumber(metrics.bannerPlansSold)} lượt mua`,
  },
  {
    key: 'depositAmount',
    label: 'Tiền cọc phát sinh',
    icon: Banknote,
    tone: 'blue',
    isCurrency: true,
    seriesKey: 'depositOverTime',
    detail: (metrics) => `${formatNumber(metrics.depositCount)} lượt cọc`,
  },
  {
    key: 'topupAmount',
    label: 'Tổng tiền nạp',
    icon: Wallet,
    tone: 'green',
    isCurrency: true,
    seriesKey: 'topupOverTime',
    detail: (metrics) => `${formatNumber(metrics.topupCount)} lượt nạp thành công`,
  },
  {
    key: 'withdrawAmount',
    label: 'Tiền rút thành công',
    icon: Wallet,
    tone: 'orange',
    isCurrency: true,
    seriesKey: 'withdrawOverTime',
    detail: (metrics) => `${formatNumber(metrics.withdrawCount)} lượt rút thành công`,
  },
  {
    key: 'escrowAmount',
    label: 'Tiền đang treo',
    icon: Banknote,
    tone: 'blue',
    isCurrency: true,
    seriesKey: 'escrowOverTime',
    detail: (metrics) => `${formatNumber(metrics.escrowCount)} đơn chưa quyết toán`,
  },
  {
    key: 'sellerVerificationRequests',
    label: 'Seller chờ duyệt',
    icon: UserCheck,
    tone: 'orange',
    isCurrency: false,
    seriesKey: 'sellerVerificationsOverTime',
  },
  {
    key: 'newReports',
    label: 'Khiếu nại chờ xử lý',
    icon: AlertTriangle,
    tone: 'red',
    isCurrency: false,
    seriesKey: 'reportsOverTime',
  },
  {
    key: 'reportedShops',
    label: 'Shop bị báo cáo',
    icon: FastMarkShopPinIcon,
    tone: 'red',
    isCurrency: false,
    seriesKey: 'reportedShopsOverTime',
  },
  {
    key: 'newBanners',
    label: 'Banner đang chạy',
    icon: Image,
    tone: 'purple',
    isCurrency: false,
    seriesKey: 'bannersOverTime',
  },
];

function formatFullDate(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-');
  return year && month && day ? `${day}-${month}-${year}` : dateKey;
}

const DAILY_PAGE_SIZE = 10;

function DailyPerformanceTable({ charts }) {
  const [page, setPage] = useState(0);

  // Ghép mọi chuỗi theo ngày thành từng dòng, ngày mới nhất lên đầu.
  const rows = useMemo(() => {
    const base = charts.usersOverTime || [];
    return base
      .map((item, index) => ({
        date: item.date,
        values: METRIC_DEFS.map(
          (def) => Number((charts[def.seriesKey] || [])[index]?.value) || 0
        ),
      }))
      .reverse();
  }, [charts]);

  useEffect(() => {
    setPage(0);
  }, [charts]);

  const pageCount = Math.max(1, Math.ceil(rows.length / DAILY_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(
    safePage * DAILY_PAGE_SIZE,
    safePage * DAILY_PAGE_SIZE + DAILY_PAGE_SIZE
  );

  return (
    <section className="panel daily-perf-panel">
      <h2>Hiệu suất hàng ngày</h2>
      <div className="daily-perf-scroll">
        <table className="daily-perf-table">
          <thead>
            <tr>
              <th>Ngày</th>
              {METRIC_DEFS.map((def) => (
                <th key={def.key}>{def.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.date}>
                <td>{formatFullDate(row.date)}</td>
                {METRIC_DEFS.map((def, index) => (
                  <td key={def.key}>
                    {def.isCurrency
                      ? formatCompactNumber(row.values[index])
                      : formatNumber(row.values[index])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="daily-perf-pager">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Trước
          </button>
          <span>
            Trang {safePage + 1}/{pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Sau
          </button>
        </div>
      ) : null}
    </section>
  );
}

function RankAvatar({ src, alt, fallback }) {
  return (
    <PreviewableImage
      src={src}
      alt={alt || ''}
      width={48}
      height={48}
      shape="rounded"
      className="rank-avatar"
      fallbackLetter={fallback || '?'}
      fallbackClassName="rank-avatar rank-avatar-fallback"
    />
  );
}

function TopRankPanel({ title, subtitle, rows, renderRow }) {
  const topRows = rows.slice(0, 10);

  return (
    <section className="panel rank-panel">
      <div className="rank-panel-head">
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
      {rows.length === 0 ? (
        <p className="rank-empty">Chưa có dữ liệu trong khoảng thời gian này.</p>
      ) : (
        <ol className="rank-list">
          {topRows.map((row, index) => renderRow(row, index))}
        </ol>
      )}
    </section>
  );
}

function rankBadgeClass(index) {
  if (index === 0) return 'rank-num rank-gold';
  if (index === 1) return 'rank-num rank-silver';
  if (index === 2) return 'rank-num rank-bronze';
  return 'rank-num';
}

function TrendChartSection({ metricDef, charts }) {
  return (
    <section className="panel dashboard-trend-panel">
      <h2>
        Xu hướng theo thời gian
        <span className="trend-panel-metric"> — {metricDef.label}</span>
      </h2>
      <AreaChart
        data={charts[metricDef.seriesKey] || []}
        color="#076F32"
        isCurrency={metricDef.isCurrency}
      />
    </section>
  );
}

export default function DashboardPage() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const today = useMemo(() => presetDates(1), []);
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(today.from);
  const [to, setTo] = useState(today.to);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // null = chưa chọn ô nào, ẩn biểu đồ xu hướng cho gọn.
  const [selectedMetric, setSelectedMetric] = useState(null);

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (!from || !to) return;
      // silent = đồng bộ realtime: giữ nguyên số liệu đang xem, chỉ ô nào đổi mới render lại.
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const token = await getIdToken();
        const data = await getAdminDashboard(token, { from, to });
        setDashboard((current) => keepIfSame(current, data));
      } catch (loadError) {
        if (silent) {
          return;
        }
        setError(loadError.message || 'Không tải được dashboard.');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [from, getIdToken, to]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useAdminRealtimeRefresh('*', () => loadDashboard({ silent: true }), {
    coalesceMs: REALTIME_COALESCE_MS,
  });

  const cards = dashboard?.cards || {};
  const charts = dashboard?.charts || {};
  const metrics = dashboard?.metrics || {};
  const previous = dashboard?.previousPeriod || {};
  const rankings = dashboard?.rankings || {};
  const singleDay = from === to;
  const mismatch =
    Number(cards.escrowBalance) !== Number(cards.escrowReservationsAmount);
  const selectedDef = selectedMetric
    ? METRIC_DEFS.find((def) => def.key === selectedMetric) || null
    : null;

  const renderMetricCard = (key) => {
    const def = METRIC_DEFS.find((item) => item.key === key);
    if (!def) return null;
    return (
      <MetricCard
        key={def.key}
        label={def.label}
        icon={def.icon}
        tone={def.tone}
        value={
          def.isCurrency
            ? formatCurrency(metrics[def.key])
            : formatNumber(metrics[def.key])
        }
        detail={def.detail ? def.detail(metrics) : undefined}
        hasTrend
        current={metrics[def.key]}
        previous={previous[def.key]}
        active={selectedMetric === def.key}
        onClick={() =>
          setSelectedMetric((prev) => (prev === def.key ? null : def.key))
        }
      />
    );
  };

  return (
    <div className="page dashboard-page">
      <section className="dashboard-toolbar">
        <DashboardDateRange
          from={from}
          to={to}
          preset={preset}
          onApply={(range) => {
            setPreset(range.preset);
            setFrom(range.from);
            setTo(range.to);
          }}
        />
        <span className="dashboard-updated">
          Dữ liệu đến {new Date().toLocaleString('vi-VN')}
        </span>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {loading && !dashboard ? (
        <div className="dashboard-skeleton">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton skeleton-card" />
          ))}
        </div>
      ) : null}

      {dashboard ? (
        <>
          <section>
            <div className="dashboard-row dashboard-row-4">
              {[
                'newUsers',
                'newSellers',
                'newProducts',
                'newReservations',
                'completedReservations',
                'cancelledReservations',
                'disputedReservations',
                'sellerPlanRevenue',
                'bannerPlanRevenue',
                'newBanners',
                'topupAmount',
                'withdrawAmount',
                'depositAmount',
                'escrowAmount',
                'sellerVerificationRequests',
                'newReports',
                'reportedShops',
              ].map(renderMetricCard)}
            </div>
            {mismatch ? (
              <p className="dashboard-warning">
                Cảnh báo đối soát: số dư ví hệ thống ({formatCurrency(cards.escrowBalance)}) khác
                tổng cọc chưa quyết toán ({formatCurrency(cards.escrowReservationsAmount)}).
              </p>
            ) : null}
          </section>

          {selectedDef && !singleDay ? (
            <TrendChartSection metricDef={selectedDef} charts={charts} />
          ) : null}

          {!singleDay ? <DailyPerformanceTable charts={charts} /> : null}

          <div className="rank-row">
            <TopRankPanel
              title="Top 10 shop bán chạy"
              subtitle="Theo doanh thu đơn hoàn thành trong kỳ"
              rows={rankings.topSellingShops || []}
              renderRow={(shop, index) => (
                <li
                  key={shop.shopId}
                  className="rank-item rank-item-click"
                  title="Xem chi tiết shop"
                  onClick={() => navigate(`/shops/${shop.shopId}`)}
                >
                  <span className={rankBadgeClass(index)}>{index + 1}</span>
                  <RankAvatar
                    src={shop.avatar}
                    alt={shop.shopName}
                    fallback={(shop.shopName || 'S').charAt(0).toUpperCase()}
                  />
                  <div className="rank-info">
                    <strong>{shop.shopName}</strong>
                    <small>{formatNumber(shop.orders)} đơn hoàn thành</small>
                  </div>
                  <div className="rank-value">
                    <strong>{formatCurrency(shop.revenue)}</strong>
                    <small>doanh thu</small>
                  </div>
                </li>
              )}
            />
            <TopRankPanel
              title="Top 10 sản phẩm bán chạy"
              subtitle="Theo số lượng bán từ đơn hoàn thành trong kỳ"
              rows={rankings.topSellingProducts || []}
              renderRow={(product, index) => (
                <li
                  key={product.productId}
                  className="rank-item rank-item-click"
                  title="Xem chi tiết sản phẩm"
                  onClick={() => navigate(`/products/${product.productId}`)}
                >
                  <span className={rankBadgeClass(index)}>{index + 1}</span>
                  <RankAvatar
                    src={product.thumbnail}
                    alt={product.name}
                    fallback={(product.name || 'P').charAt(0).toUpperCase()}
                  />
                  <div className="rank-info">
                    <strong>{product.name}</strong>
                    <small>
                      {product.shopName ? `${product.shopName} · ` : ''}
                      {formatNumber(product.soldQuantity)} đã bán · {formatNumber(product.orders)} đơn
                    </small>
                  </div>
                  <div className="rank-value">
                    <strong>{formatCurrency(product.revenue)}</strong>
                    <small>doanh thu</small>
                  </div>
                </li>
              )}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

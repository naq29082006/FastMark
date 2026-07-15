import { useCallback, useEffect, useState } from 'react';

import { getAdminDashboard } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';

function formatCompact(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('vi-VN').format(number);
}

function formatCurrency(value) {
  return `${formatCompact(value)} ₫`;
}

function LineChart({ data = [], color = '#0d7377', height = 180 }) {
  const width = 560;
  const padding = 24;
  const values = data.map((item) => Number(item.value) || 0);
  const max = Math.max(...values, 1);
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((item, index) => {
    const x = padding + index * stepX;
    const y = height - padding - ((Number(item.value) || 0) / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Line chart">
      <polyline fill="none" stroke={color} strokeWidth="3" points={points.join(' ')} />
      {data.map((item, index) => {
        const x = padding + index * stepX;
        const y = height - padding - ((Number(item.value) || 0) / max) * (height - padding * 2);
        return <circle key={`${item.date}-${index}`} cx={x} cy={y} r="3.5" fill={color} />;
      })}
    </svg>
  );
}

function BarChart({ data = [], color = '#0d7377', valueKey = 'value', labelKey = 'label', height = 220 }) {
  const max = Math.max(...data.map((item) => Number(item[valueKey]) || 0), 1);

  return (
    <div className="bar-chart" style={{ minHeight: height }}>
      {data.map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const percent = Math.max(4, Math.round((value / max) * 100));
        return (
          <div key={`${item[labelKey]}-${index}`} className="bar-chart-row">
            <div className="bar-chart-label">{item[labelKey]}</div>
            <div className="bar-chart-track">
              <div className="bar-chart-fill" style={{ width: `${percent}%`, background: color }} />
            </div>
            <div className="bar-chart-value">{formatCompact(value)}</div>
          </div>
        );
      })}
      {data.length === 0 ? <div className="empty-inline">Chưa có dữ liệu</div> : null}
    </div>
  );
}

function PieChart({ data = [], size = 180 }) {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0) || 1;
  const colors = ['#0d7377', '#14b8a6', '#f59e0b', '#ef4444', '#6366f1', '#94a3b8'];
  let current = 0;
  const gradients = data.map((item, index) => {
    const value = Number(item.value) || 0;
    const start = (current / total) * 100;
    current += value;
    const end = (current / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  return (
    <div className="pie-wrap">
      <div
        className="pie-chart"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${gradients.join(', ')})`,
        }}
      />
      <ul className="pie-legend">
        {data.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span style={{ background: colors[index % colors.length] }} />
            {item.label}: {formatCompact(item.value)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="dashboard-skeleton">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { getIdToken } = useAuth();
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const params = range === 'custom' ? { range: 'custom', from, to } : { range };
      const data = await getAdminDashboard(token, params);
      setDashboard(data);
    } catch (loadError) {
      setDashboard(null);
      setError(loadError.message || 'Không tải được dashboard.');
    } finally {
      setLoading(false);
    }
  }, [from, getIdToken, range, to]);

  useEffect(() => {
    if (range === 'custom' && (!from || !to)) {
      return;
    }
    loadDashboard();
  }, [loadDashboard, from, range, to]);

  const cards = dashboard?.cards || {};
  const charts = dashboard?.charts || {};
  const rankings = dashboard?.rankings || {};

  const revenueBars = (charts.revenueByShop || []).map((item) => ({
    label: item.shopName,
    value: item.revenue,
  }));

  const topFavoriteBars = (rankings.topFavoriteProducts || []).map((item) => ({
    label: item.name,
    value: item.likeCount,
  }));

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard thống kê</h1>
          <p>Dữ liệu thời gian thực từ MongoDB theo khoảng thời gian đã chọn.</p>
        </div>
        <button type="button" onClick={loadDashboard}>
          Làm mới
        </button>
      </div>

      <div className="dashboard-filters">
        <div className="filter-chips">
          {[
            { key: 'day', label: 'Hôm nay' },
            { key: 'week', label: '7 ngày' },
            { key: 'month', label: '30 ngày' },
            { key: 'custom', label: 'Tùy chọn' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={range === item.key ? 'chip active' : 'chip'}
              onClick={() => setRange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {range === 'custom' ? (
          <div className="date-range">
            <label>
              Từ
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label>
              Đến
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
        ) : null}
      </div>

      {loading ? <SkeletonDashboard /> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {!loading && dashboard ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Tổng người dùng</span>
              <strong>{formatCompact(cards.totalUsers)}</strong>
            </div>
            <div className="stat-card">
              <span>Tổng người bán</span>
              <strong>{formatCompact(cards.totalSellers)}</strong>
            </div>
            <div className="stat-card">
              <span>Tổng gian hàng</span>
              <strong>{formatCompact(cards.totalShops)}</strong>
            </div>
            <div className="stat-card">
              <span>Tổng sản phẩm</span>
              <strong>{formatCompact(cards.totalProducts)}</strong>
            </div>
            <div className="stat-card">
              <span>Tổng đơn giữ hàng</span>
              <strong>{formatCompact(cards.totalReservations)}</strong>
            </div>
            <div className="stat-card">
              <span>Doanh thu kỳ</span>
              <strong>{formatCurrency(cards.periodRevenue)}</strong>
            </div>
            <div className="stat-card">
              <span>Người mua</span>
              <strong>{formatCompact(cards.totalBuyers)}</strong>
            </div>
            <div className="stat-card">
              <span>Gian hàng hoạt động</span>
              <strong>{formatCompact(cards.totalActiveShops)}</strong>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="panel">
              <h2>Người dùng theo thời gian</h2>
              <LineChart data={charts.usersOverTime || []} />
            </section>

            <section className="panel">
              <h2>Đơn giữ hàng theo thời gian</h2>
              <LineChart data={charts.reservationsOverTime || []} color="#f59e0b" />
            </section>

            <section className="panel">
              <h2>Phân bố trạng thái đơn</h2>
              <PieChart data={charts.reservationStatusPie || []} />
            </section>

            <section className="panel">
              <h2>Tỷ lệ vai trò</h2>
              <PieChart data={charts.rolePie || []} />
            </section>

            <section className="panel panel-wide">
              <h2>Doanh thu theo cửa hàng</h2>
              <BarChart data={revenueBars} color="#0d7377" />
            </section>

            <section className="panel panel-wide">
              <h2>Top sản phẩm được yêu thích</h2>
              <BarChart data={topFavoriteBars} color="#e11d48" />
            </section>
          </div>

          <section className="panel">
            <h2>Top cửa hàng nổi bật</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Gian hàng</th>
                    <th>Đánh giá</th>
                    <th>Yêu thích</th>
                    <th>Sản phẩm</th>
                    <th>Đã bán</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {(rankings.topShops || []).map((shop) => (
                    <tr key={shop.shopId}>
                      <td>
                        <div className="cell-with-avatar">
                          {shop.logo ? (
                            <img src={shop.logo} alt="" className="table-avatar" />
                          ) : (
                            <div className="table-avatar fallback">
                              {String(shop.name || 'G').charAt(0)}
                            </div>
                          )}
                          <span>{shop.name}</span>
                        </div>
                      </td>
                      <td>{Number(shop.rating || 0).toFixed(1)}</td>
                      <td>{formatCompact(shop.totalLikes)}</td>
                      <td>{formatCompact(shop.totalProducts)}</td>
                      <td>{formatCompact(shop.soldCount)}</td>
                      <td>
                        <span className={shop.isOpen ? 'badge badge-success' : 'badge badge-danger'}>
                          {shop.isOpen ? 'Mở cửa' : 'Đóng cửa'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(rankings.topShops || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-inline">
                        Chưa có dữ liệu cửa hàng nổi bật.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

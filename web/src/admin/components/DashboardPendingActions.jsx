import { Card, Skeleton } from 'antd';
import { Link } from 'react-router-dom';

import { formatNumber } from '../utils/format';

function PendingCard({ title, count, loading, to }) {
  const value = Math.max(0, Number(count) || 0);

  return (
    <Card size="small" className="admin-stat-card-item admin-dashboard-pending-stat">
      {loading ? (
        <Skeleton active paragraph={false} title={{ width: '60%' }} />
      ) : (
        <>
          <div className="admin-dashboard-pending-stat-head">
            <div className="admin-stat-card-item-title">{title}</div>
            <Link to={to} className="admin-dashboard-pending-link">
              Chi tiết
            </Link>
          </div>
          <div className="admin-stat-card-item-value">{formatNumber(value)}</div>
        </>
      )}
    </Card>
  );
}

export default function DashboardPendingActions({ loading = false, pending = {} }) {
  const items = [
    {
      key: 'sellers',
      title: 'Seller chờ duyệt',
      count: pending.sellerVerifications,
      to: '/sellers?status=0',
    },
    {
      key: 'reservationDisputes',
      title: 'Tranh chấp chưa xử lý',
      count: pending.reservationDisputes,
      to: '/reservations?status=dispute',
    },
    {
      key: 'contentReports',
      title: 'Khiếu nại & tố cáo chưa xử lý',
      count: pending.reports,
      to: '/disputes',
    },
    {
      key: 'withdrawals',
      title: 'Rút tiền chờ duyệt',
      count: pending.withdrawCount,
      to: '/withdrawals',
    },
  ];

  return (
    <section className="admin-dashboard-pending">
      <h2 className="admin-dashboard-pending-title">Cần xử lý</h2>
      <div className="admin-stat-cards-section">
        <div className="admin-stat-cards-grid" style={{ '--stat-columns': 4 }}>
          {items.map((item) => (
            <PendingCard
              key={item.key}
              title={item.title}
              count={item.count}
              loading={loading}
              to={item.to}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

import { Card, Skeleton } from 'antd';

import { formatCurrency, formatNumber } from '../utils/format';

export default function StatCards({ items = [], loading = false, columns = 4 }) {
  const columnCount = Math.max(1, Math.min(columns, items.length || 1));

  return (
    <div className="admin-stat-cards-section">
      <div className="admin-stat-cards-grid" style={{ '--stat-columns': columnCount }}>
        {items.map((item) => {
          const numericValue = Number(item.value) || 0;
          const display =
            typeof item.value === 'string'
              ? item.value
              : item.formatter?.(numericValue) ??
                (item.isCurrency ? formatCurrency(numericValue) : formatNumber(numericValue));

          return (
            <Card
              key={item.key || item.title}
              loading={false}
              size="small"
              hoverable={Boolean(item.onClick)}
              onClick={item.onClick}
              className="admin-stat-card-item"
            >
              {loading ? (
                <Skeleton active paragraph={false} title={{ width: '60%' }} />
              ) : (
                <>
                  <div className="admin-stat-card-item-title">{item.title}</div>
                  <div className="admin-stat-card-item-value">{display}</div>
                </>
              )}
              {!loading && item.description ? (
                <div className="admin-stat-card-item-desc">{item.description}</div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

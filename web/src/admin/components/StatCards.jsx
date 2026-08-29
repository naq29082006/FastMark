import { Card, Skeleton } from 'antd';

import { formatCurrency, formatNumber } from '../utils/format';
import { enrichStatItems } from '../utils/statCardPresets';

export default function StatCards({ items = [], loading = false, columns = 4, singleRow = false }) {
  const enrichedItems = enrichStatItems(items);
  const columnCount = Math.max(1, Math.min(columns, enrichedItems.length || 1));

  return (
    <div className="admin-stat-cards-section">
      <div
        className={`admin-stat-cards-grid${singleRow ? ' admin-stat-cards-grid--single-row' : ''}`}
        style={{ '--stat-columns': columnCount }}
      >
        {enrichedItems.map((item) => {
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
              className={`admin-stat-card-item${item.onClick ? '' : ' admin-stat-card-item--static'}`}
              onClick={item.onClick}
            >
              {loading ? (
                <Skeleton active paragraph={false} title={{ width: '60%' }} />
              ) : (
                <div className="admin-stat-card-item-inner">
                  {item.icon ? (
                    <div className={`admin-stat-card-icon tone-${item.tone || 'slate'}`}>
                      {item.icon}
                    </div>
                  ) : null}
                  <div className="admin-stat-card-item-content">
                    <div className="admin-stat-card-item-title">{item.title}</div>
                    <div className="admin-stat-card-item-value">{display}</div>
                    {item.description ? (
                      <div className="admin-stat-card-item-desc">{item.description}</div>
                    ) : null}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

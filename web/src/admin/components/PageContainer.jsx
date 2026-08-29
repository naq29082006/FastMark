import { Card, Space } from 'antd';

export default function PageContainer({ extra, extraAlign = 'end', children, stats, noPadding = false }) {
  const justifyContent =
    extraAlign === 'start' || extraAlign === 'left' ? 'flex-start' : 'flex-end';

  return (
    <div style={{ padding: noPadding ? 0 : '0 0 24px' }}>
      {extra ? (
        <div
          className={extraAlign === 'start' || extraAlign === 'left' ? 'admin-page-toolbar admin-page-toolbar--start' : 'admin-page-toolbar'}
          style={{
            display: 'flex',
            justifyContent,
            marginBottom: stats ? 24 : 16,
            flexWrap: 'wrap',
          }}
        >
          <Space wrap size="middle">
            {extra}
          </Space>
        </div>
      ) : null}
      {stats ? <div className="admin-page-stats" style={{ marginBottom: 24 }}>{stats}</div> : null}
      {children}
    </div>
  );
}

export function PanelCard({ title, extra, children, style, className }) {
  return (
    <Card
      className={['admin-panel-card', className].filter(Boolean).join(' ')}
      title={title}
      extra={extra}
      style={{ marginBottom: 16, ...style }}
      styles={{ body: { padding: 16 } }}
    >
      {children}
    </Card>
  );
}

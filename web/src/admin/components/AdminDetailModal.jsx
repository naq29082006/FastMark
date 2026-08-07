import { Modal, Spin } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

/**
 * Modal chi tiết admin — XL hoặc gần fullscreen, không đổi route.
 */
export default function AdminDetailModal({
  open,
  onClose,
  title,
  subtitle,
  loading = false,
  width = 1040,
  fullscreen = false,
  footer = null,
  extra = null,
  children,
}) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={footer}
      width={fullscreen ? '100vw' : width}
      className={`admin-detail-modal ${fullscreen ? 'admin-detail-modal--fullscreen' : 'admin-detail-modal--xl'}`}
      title={null}
      closable={false}
      destroyOnClose
      centered={!fullscreen}
      styles={{
        body: { padding: 0, maxHeight: fullscreen ? 'calc(100vh - 48px)' : 'min(82vh, 900px)', overflow: 'auto' },
      }}
    >
      <div className="admin-detail-modal-shell">
        <header className="admin-detail-modal-header">
          <div className="admin-detail-modal-header-text">
            <h2>{title}</h2>
            {subtitle ? <p className="admin-detail-modal-sub">{subtitle}</p> : null}
          </div>
          <div className="admin-detail-modal-header-actions">
            {extra}
            <button type="button" className="admin-detail-modal-close" onClick={onClose} aria-label="Đóng">
              <CloseOutlined />
              <span>Đóng</span>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="admin-detail-modal-loading">
            <Spin size="large" tip="Đang tải chi tiết..." />
          </div>
        ) : (
          <div className="admin-detail-modal-body">{children}</div>
        )}
      </div>
    </Modal>
  );
}

export function AdminDetailSection({ title, description, children, actions }) {
  return (
    <section className="admin-detail-modal-section">
      <div className="admin-detail-modal-section-head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="admin-detail-modal-section-actions">{actions}</div> : null}
      </div>
      <div className="admin-detail-modal-section-body">{children}</div>
    </section>
  );
}

export function AdminDetailDl({ items = [] }) {
  return (
    <dl className="admin-detail-dl admin-detail-dl--modal">
      {items.map((item) => (
        <div key={item.key || item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminDetailTimeline({ entries = [] }) {
  if (!entries.length) {
    return <p className="admin-detail-empty">Chưa có nhật ký xử lý.</p>;
  }
  return (
    <ol className="admin-detail-timeline">
      {entries.map((entry) => (
        <li key={entry.key || `${entry.at}-${entry.title}`}>
          <div className="admin-detail-timeline-dot" />
          <div className="admin-detail-timeline-content">
            <strong>{entry.title}</strong>
            {entry.detail ? <p>{entry.detail}</p> : null}
            {entry.at ? <time>{entry.at}</time> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

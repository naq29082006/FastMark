import { Image, Tag } from 'antd';
import { Link } from 'react-router-dom';

import { formatDateTime } from '../utils/format';
import { AdminDetailDl, AdminDetailSection, AdminDetailTimeline } from './AdminDetailModal';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

function statusTag(status) {
  if (status === 0) return <Tag color="orange">Chờ xử lý</Tag>;
  if (status === 1) return <Tag color="green">Đã xử lý</Tag>;
  return <Tag color="red">Đã bác bỏ</Tag>;
}

function personBlock(person, fallback = '—') {
  if (!person) return fallback;
  const name = person.fullName || person.userName || fallback;
  const lines = [name];
  if (person.userName && person.fullName) lines.push(`@${person.userName}`);
  if (person.email) lines.push(person.email);
  return (
    <div className="admin-detail-person">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

function buildTimeline(report) {
  const entries = [];
  if (report?.createdAt) {
    entries.push({
      key: 'created',
      title: 'Tạo báo cáo',
      detail: report.reporter?.fullName || report.reporter?.userName || 'Người gửi',
      at: formatDateTime(report.createdAt),
    });
  }
  if (report?.processedAt) {
    entries.push({
      key: 'processed',
      title: report.status === 1 ? 'Đã xử lý' : report.status === 2 ? 'Đã bác bỏ' : 'Cập nhật trạng thái',
      detail: [
        report.processedBy?.fullName || report.processedBy?.userName || 'Admin',
        report.adminNote || report.adminDecision || '',
      ]
        .filter(Boolean)
        .join(' — '),
      at: formatDateTime(report.processedAt),
    });
  }
  return entries;
}

export default function ReportDetailPanel({ report }) {
  if (!report) return null;

  const images = (report.evidenceImages || report.images || [])
    .map((item) => (typeof item === 'string' ? item : item?.url || item?.imageUrl))
    .filter(Boolean);

  return (
    <div className="admin-detail-modal-grid">
      <AdminDetailSection title="Thông tin báo cáo">
        <AdminDetailDl
          items={[
            { label: 'Mã', value: report.id || report._id },
            { label: 'Loại', value: report.reportTypeLabel || report.reportType },
            { label: 'Tiêu đề', value: report.title || report.reasonLabel },
            { label: 'Trạng thái', value: statusTag(report.status) },
            { label: 'Ngày tạo', value: formatDateTime(report.createdAt || report.CreatedAt) },
            {
              label: 'Đơn liên quan',
              value: report.reservationId ? (
                <Link to={`/reservations/${report.reservationId}`}>#{report.reservationId}</Link>
              ) : (
                '—'
              ),
            },
          ]}
        />
      </AdminDetailSection>

      <AdminDetailSection title="Người báo cáo">
        {personBlock(report.reporter)}
      </AdminDetailSection>

      <AdminDetailSection title="Đối tượng bị báo cáo">
        <AdminDetailDl
          items={[
            { label: 'Mô tả', value: report.targetSubjectLabel || '—' },
            { label: 'Người dùng', value: personBlock(report.targetUser, '—') },
            {
              label: 'Gian hàng',
              value: report.shop?.name || report.targetShopName || report.target_shop_name || '—',
            },
            {
              label: 'Sản phẩm',
              value: report.product?.name || report.targetProductName || report.target_product_name || '—',
            },
          ]}
        />
        {report.shop?.id ? (
          <p style={{ marginTop: 8 }}>
            <Link to={`/sellers/shops/${report.shop.id}`}>Xem gian hàng</Link>
          </p>
        ) : null}
        {report.product?.id ? (
          <p>
            <Link to={`/products/${report.product.id}`}>Xem sản phẩm</Link>
          </p>
        ) : null}
      </AdminDetailSection>

      <AdminDetailSection title="Nội dung báo cáo">
        <div className="admin-detail-prose">{report.content || report.description || '—'}</div>
      </AdminDetailSection>

      {report.review?.id || report.review?.comment ? (
        <AdminDetailSection title="Đánh giá liên quan">
          <AdminDetailDl
            items={[
              { label: 'Sao', value: report.review.rating ?? '—' },
              { label: 'Nội dung', value: report.review.comment || '—' },
            ]}
          />
        </AdminDetailSection>
      ) : null}

      <AdminDetailSection title="Ảnh đính kèm" description={images.length ? `${images.length} ảnh` : undefined}>
        {images.length ? (
          <div className="admin-detail-image-grid">
            <Image.PreviewGroup>
              {images.map((src, index) => (
                <Image
                  key={`${src}-${index}`}
                  src={resolveMediaUrl(src)}
                  alt=""
                  width={120}
                  height={120}
                  style={{ objectFit: 'cover', borderRadius: 12 }}
                />
              ))}
            </Image.PreviewGroup>
          </div>
        ) : (
          <p className="admin-detail-empty">Không có ảnh đính kèm.</p>
        )}
      </AdminDetailSection>

      <AdminDetailSection title="Lịch sử xử lý">
        <AdminDetailTimeline entries={buildTimeline(report)} />
      </AdminDetailSection>
    </div>
  );
}

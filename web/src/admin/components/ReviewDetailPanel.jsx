import { Image, Rate, Tag } from 'antd';
import { Link } from 'react-router-dom';

import { formatDateTime } from '../utils/format';
import { AdminDetailDl, AdminDetailSection, AdminDetailTimeline } from './AdminDetailModal';
import ShopCell from './ShopCell';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

function visibilityTag(review) {
  if (review?.isDeleted || review?.deletedAt) {
    return <Tag color="error">Đã xóa</Tag>;
  }
  if (review?.isHidden || review?.adminHidden) {
    return <Tag color="warning">Đã ẩn</Tag>;
  }
  return <Tag color="success">Hiển thị</Tag>;
}

function buildTimeline(review) {
  const entries = [];
  if (review?.createdAt) {
    entries.push({
      key: 'created',
      title: 'Tạo đánh giá',
      detail: review.reviewer?.fullName || review.reviewer?.userName || 'Người đánh giá',
      at: formatDateTime(review.createdAt),
    });
  }
  if (review?.removedAt) {
    entries.push({
      key: 'moderated',
      title: review.isDeleted || review.deletedAt ? 'Admin xóa mềm' : 'Admin ẩn',
      detail: review.adminRemovalReason || review.removalReason || '—',
      at: formatDateTime(review.removedAt),
    });
  }
  return entries;
}

export default function ReviewDetailPanel({ review }) {
  if (!review) return null;

  const images = (review.images || [])
    .map((item) => (typeof item === 'string' ? item : item?.imageUrl || item?.url))
    .filter(Boolean);
  if (!images.length && review.imageUrl) {
    images.push(review.imageUrl);
  }

  return (
    <div className="admin-detail-modal-grid">
      <AdminDetailSection title="Thông tin đánh giá">
        <AdminDetailDl
          items={[
            { label: 'Mã', value: review.id || review._id },
            { label: 'Sao', value: <Rate disabled value={Number(review.rating) || 0} /> },
            { label: 'Trạng thái', value: visibilityTag(review) },
            { label: 'Ngày tạo', value: formatDateTime(review.createdAt) },
            {
              label: 'Đơn hàng',
              value: review.reservationId ? (
                <Link to={`/reservations/${review.reservationId}`}>#{review.reservationId}</Link>
              ) : (
                '—'
              ),
            },
          ]}
        />
      </AdminDetailSection>

      <AdminDetailSection title="Người đánh giá">
        <AdminDetailDl
          items={[
            { label: 'Họ tên', value: review.reviewer?.fullName || '—' },
            { label: 'Username', value: review.reviewer?.userName || '—' },
            { label: 'Email', value: review.reviewer?.email || '—' },
          ]}
        />
      </AdminDetailSection>

      <AdminDetailSection title="Gian hàng / người được đánh giá">
        <ShopCell
          shopName={review.shopName}
          shopUsername={review.shopUsername}
          shopAvatar={review.shopAvatar}
        />
        {review.shopId ? (
          <p style={{ marginTop: 12 }}>
            <Link to={`/sellers/shops/${review.shopId}`}>Mở hồ sơ gian hàng</Link>
          </p>
        ) : null}
      </AdminDetailSection>

      <AdminDetailSection title="Sản phẩm liên quan">
        <AdminDetailDl
          items={[
            { label: 'Tên', value: review.productName || '—' },
            {
              label: 'Chi tiết',
              value: review.productId ? <Link to={`/products/${review.productId}`}>Xem sản phẩm</Link> : '—',
            },
          ]}
        />
      </AdminDetailSection>

      <AdminDetailSection title="Nội dung">
        <div className="admin-detail-prose">{review.comment || '—'}</div>
      </AdminDetailSection>

      <AdminDetailSection title="Hình ảnh">
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
          <p className="admin-detail-empty">Không có hình ảnh.</p>
        )}
      </AdminDetailSection>

      <AdminDetailSection title="Nhật ký kiểm duyệt">
        <AdminDetailTimeline entries={buildTimeline(review)} />
      </AdminDetailSection>
    </div>
  );
}

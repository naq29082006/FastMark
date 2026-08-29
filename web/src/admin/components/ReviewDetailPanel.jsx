import { Button, Descriptions, Rate, Tag } from 'antd';

import { formatDateTime } from '../utils/format';
import { formatReservationOrderCodeShort } from '../../utils/reservationOrderCode';
import ProductCell from './ProductCell';
import ShopCell from './ShopCell';
import { PreviewableImageGrid } from '../../components/PreviewableImage';

function visibilityTag(review) {
  if (review?.isDeleted || review?.deletedAt) {
    return <Tag color="error">Đã xóa</Tag>;
  }
  if (review?.isHidden || review?.adminHidden) {
    return <Tag color="warning">Đã ẩn</Tag>;
  }
  return <Tag color="success">Hiển thị</Tag>;
}

function collectReviewImages(review) {
  const images = (review?.images || [])
    .map((item) => (typeof item === 'string' ? item : item?.imageUrl || item?.url))
    .filter(Boolean);
  if (!images.length && review?.imageUrl) {
    images.push(review.imageUrl);
  }
  return images;
}

export default function ReviewDetailPanel({ review, onNavigate }) {
  if (!review) return null;

  const images = collectReviewImages(review);
  const comment = String(review.comment || '').trim();
  const orderCode = review.orderCode || formatReservationOrderCodeShort(review.reservationId);
  const reviewerId = review.reviewer?.id;

  function go(path) {
    if (path && onNavigate) {
      onNavigate(path);
    }
  }

  return (
    <div className="admin-review-detail-panel">
      <Descriptions bordered column={1} size="small" className="admin-review-detail-descriptions">
        <Descriptions.Item label="Mã đơn">
          {review.reservationId && orderCode ? (
            <Button type="link" className="admin-review-detail-link" onClick={() => go(`/reservations/${review.reservationId}`)}>
              {orderCode}
            </Button>
          ) : (
            '—'
          )}
        </Descriptions.Item>

        <Descriptions.Item label="Sản phẩm">
          <ProductCell
            productName={review.productName}
            productImage={review.productImage}
            onClick={review.productId ? () => go(`/products/${review.productId}`) : undefined}
          />
        </Descriptions.Item>

        <Descriptions.Item label="Người đánh giá">
          <ShopCell
            shopName={review.reviewer?.fullName || review.reviewer?.userName || 'Khách hàng'}
            shopUsername={review.reviewer?.fullName ? review.reviewer?.userName : ''}
            avatar={review.reviewer?.avatar}
            onClick={reviewerId ? () => go(`/users/${reviewerId}`) : undefined}
          />
        </Descriptions.Item>

        <Descriptions.Item label="Số sao">
          <Rate disabled allowHalf={false} value={Number(review.rating) || 0} />
        </Descriptions.Item>

        <Descriptions.Item label="Nội dung">{comment || '—'}</Descriptions.Item>

        {images.length ? (
          <Descriptions.Item label="Ảnh đính kèm">
            <PreviewableImageGrid
              items={images}
              className="admin-review-detail-images previewable-image-grid"
            />
          </Descriptions.Item>
        ) : null}

        <Descriptions.Item label="Thời gian đánh giá">
          {formatDateTime(review.createdAt) || '—'}
        </Descriptions.Item>

        <Descriptions.Item label="Trạng thái">{visibilityTag(review)}</Descriptions.Item>

        {review.removedAt ? (
          <Descriptions.Item label="Kiểm duyệt">
            <div className="admin-review-detail-moderation">
              <div>{review.isDeleted || review.deletedAt ? 'Admin xóa mềm' : 'Admin ẩn'}</div>
              <div className="admin-review-detail-moderation-reason">
                {review.lyDoGo || review.removalReason || '—'}
              </div>
              <div className="admin-review-detail-moderation-at">{formatDateTime(review.removedAt)}</div>
            </div>
          </Descriptions.Item>
        ) : null}
      </Descriptions>
    </div>
  );
}

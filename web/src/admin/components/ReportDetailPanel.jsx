import { Descriptions, Tag } from 'antd';

import { formatDateTime } from '../utils/format';
import ShopCell from './ShopCell';
import ProductCell from './ProductCell';
import { PreviewableImageGrid } from '../../components/PreviewableImage';

function statusTag(status) {
  if (status === 0) return <Tag color="orange">Chờ xử lý</Tag>;
  if (status === 1) return <Tag color="green">Đã xử lý</Tag>;
  return <Tag color="red">Đã bác bỏ</Tag>;
}

function collectReportImages(report) {
  return (report?.evidenceImages || report?.images || [])
    .map((item) => (typeof item === 'string' ? item : item?.url || item?.imageUrl))
    .filter(Boolean);
}

function resolveTargetLink(report) {
  const product = report?.product;
  const shop = report?.shop;
  const targetUser = report?.targetUser;

  if (product?.id) {
    return {
      path: `/products/${product.id}`,
      product,
    };
  }
  if (shop?.id) {
    return {
      path: `/sellers/shops/${shop.id}`,
      shop,
    };
  }
  if (targetUser?.id) {
    return {
      path: `/users/${targetUser.id}`,
      user: targetUser,
    };
  }
  return null;
}

export default function ReportDetailPanel({ report, onNavigate }) {
  if (!report) return null;

  const images = collectReportImages(report);
  const content = String(report.content || report.description || '').trim();
  const reporter = report.reporter;
  const target = resolveTargetLink(report);
  const shop = report.shop;
  const product = report.product;
  const targetUser = report.targetUser;

  function go(path) {
    if (path && onNavigate) {
      onNavigate(path);
    }
  }

  const targetName =
    product?.name ||
    shop?.name ||
    report.targetSubjectLabel ||
    targetUser?.fullName ||
    targetUser?.userName ||
    '—';

  return (
    <div className="admin-report-detail-panel">
      <Descriptions bordered column={1} size="small" className="admin-report-detail-descriptions">
        <Descriptions.Item label="Người gửi">
          <ShopCell
            shopName={reporter?.fullName || reporter?.userName || '—'}
            shopUsername={reporter?.fullName ? reporter?.userName : ''}
            avatar={reporter?.avatar}
            onClick={reporter?.id ? () => go(`/users/${reporter.id}`) : undefined}
          />
        </Descriptions.Item>

        <Descriptions.Item label="Đối tượng">
          {product?.id ? (
            <ProductCell
              productName={product.name}
              productImage={product.image}
              onClick={() => go(`/products/${product.id}`)}
            />
          ) : shop?.id || targetUser?.id ? (
            <ShopCell
              shopName={shop?.name || targetUser?.fullName || targetUser?.userName || targetName}
              shopUsername={
                shop?.shopUsername ||
                (targetUser?.fullName ? targetUser?.userName : targetUser?.userName || '')
              }
              avatar={shop?.avatar || targetUser?.avatar}
              onClick={target?.path ? () => go(target.path) : undefined}
            />
          ) : (
            targetName
          )}
        </Descriptions.Item>

        <Descriptions.Item label="Nội dung">
          <div className="admin-report-detail-content">{content || '—'}</div>
        </Descriptions.Item>

        {images.length ? (
          <Descriptions.Item label="Ảnh đính kèm">
            <PreviewableImageGrid
              items={images}
              className="admin-report-detail-images previewable-image-grid"
            />
          </Descriptions.Item>
        ) : null}

        <Descriptions.Item label="Ngày gửi">
          {formatDateTime(report.createdAt || report.CreatedAt) || '—'}
        </Descriptions.Item>

        <Descriptions.Item label="Trạng thái">{statusTag(report.status)}</Descriptions.Item>

        {report.adminNote || report.qdAdmin ? (
          <Descriptions.Item label="Ghi chú admin">
            {report.adminNote || report.qdAdmin}
          </Descriptions.Item>
        ) : null}

        {report.tgXuLy ? (
          <Descriptions.Item label="Ngày xử lý">
            {formatDateTime(report.tgXuLy)}
          </Descriptions.Item>
        ) : null}
      </Descriptions>
    </div>
  );
}

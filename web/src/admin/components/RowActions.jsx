import { Button } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';

/**
 * Hành động hàng ngang: Xem · Sửa (tuỳ chọn) · Xóa (tuỳ chọn).
 * Không dùng nút Ẩn/Hiện.
 */
export default function RowActions({
  onView,
  onEdit,
  onDelete,
  viewLoading = false,
  editLoading = false,
  deleteLoading = false,
  viewLabel = 'Xem',
  editLabel = 'Sửa',
  deleteLabel = 'Xóa',
}) {
  return (
    <div className="admin-row-actions">
      {onView ? (
        <Button type="link" size="small" icon={<EyeOutlined />} loading={viewLoading} onClick={onView}>
          {viewLabel}
        </Button>
      ) : null}
      {onEdit ? (
        <Button type="link" size="small" icon={<EditOutlined />} loading={editLoading} onClick={onEdit}>
          {editLabel}
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          loading={deleteLoading}
          onClick={onDelete}
        >
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
}

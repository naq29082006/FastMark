import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Modal, Rate, Space, Table, Tag, message } from 'antd';

import { deleteAdminReview, getAdminReviewDetail, hideAdminReview, listAdminReviews, showAdminReview } from '../../api/adminReviewApi';
import AdminDetailModal from '../components/AdminDetailModal';
import ReviewDetailPanel from '../components/ReviewDetailPanel';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ShopCell from '../components/ShopCell';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { formatDateTime } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS = [
  { value: 'visible', label: 'Đang hiển thị' },
  { value: 'hidden', label: 'Đã ẩn' },
];

const RATING_OPTIONS = [
  { value: '5', label: '5 sao' },
  { value: '4', label: '4 sao' },
  { value: '3', label: '3 sao' },
  { value: '2', label: '2 sao' },
  { value: '1', label: '1 sao' },
];

export default function ReviewsPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(urlStatus);
  const [rating, setRating] = useState(undefined);
  const [viewTarget, setViewTarget] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [hideReasonOpen, setHideReasonOpen] = useState(false);
  const [hideReason, setHideReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      return listAdminReviews(token, { page, limit, search, status, rating });
    },
    [getIdToken, search, status, rating]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, reload } =
    usePaginatedQuery({ fetcher, deps: [search, status, rating] });

  async function openReviewDetail(record) {
    const id = record.id || record._id;
    setViewTarget(record);
    setViewDetail(record);
    setViewLoading(true);
    try {
      const token = await getIdToken();
      const payload = await getAdminReviewDetail(token, id);
      setViewDetail(payload?.data?.review || record);
    } catch {
      setViewDetail(record);
    } finally {
      setViewLoading(false);
    }
  }

  async function handleHideToggle() {
    if (!viewDetail) return;
    const id = viewDetail.id || viewDetail._id;
    const hidden = viewDetail.isHidden || viewDetail.adminHidden;
    if (!hidden) {
      setHideReason('');
      setHideReasonOpen(true);
      return;
    }
    setActionLoading(id);
    try {
      const token = await getIdToken();
      await showAdminReview(token, id);
      message.success('Đã hiện lại đánh giá');
      await reload();
      await openReviewDetail(viewDetail);
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    } finally {
      setActionLoading('');
    }
  }

  async function confirmHideReview() {
    if (!viewDetail) return;
    const reason = hideReason.trim();
    if (!reason) {
      message.warning('Vui lòng nhập lý do ẩn');
      return;
    }
    const id = viewDetail.id || viewDetail._id;
    setActionLoading(id);
    try {
      const token = await getIdToken();
      await hideAdminReview(token, id, { reason });
      message.success('Đã ẩn đánh giá');
      setHideReasonOpen(false);
      await reload();
      await openReviewDetail(viewDetail);
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    } finally {
      setActionLoading('');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const id = deleteTarget.id || deleteTarget._id;
    const reason = deleteReason.trim();
    if (!reason) {
      message.warning('Vui lòng nhập lý do xóa');
      return;
    }
    setActionLoading(id);
    try {
      const token = await getIdToken();
      await deleteAdminReview(token, id, { reason });
      message.success('Đã xóa đánh giá');
      setDeleteTarget(null);
      setDeleteReason('');
      await reload();
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    } finally {
      setActionLoading('');
    }
  }

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Người đánh giá',
      key: 'reviewer',
      render: (_, row) => row.reviewer?.fullName || row.reviewer?.userName || '—',
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'productName',
      key: 'productName',
      render: (v, row) => v || '—',
    },
    {
      title: 'Gian hàng',
      key: 'shop',
      width: 220,
      render: (_, row) => (
        <ShopCell
          shopName={row.shopName}
          shopUsername={row.shopUsername}
          shopAvatar={row.shopAvatar}
          onClick={row.shopId ? () => navigate(`/sellers/shops/${row.shopId}`) : undefined}
        />
      ),
    },
    {
      title: 'Sao',
      dataIndex: 'rating',
      key: 'rating',
      render: (v) => <Rate disabled value={Number(v) || 0} />,
    },
    {
      title: 'Nội dung',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Trạng thái',
      key: 'visibility',
      render: (_, row) => {
        if (row.isDeleted || row.deletedAt) {
          return <Tag color="error">Đã xóa</Tag>;
        }
        if (row.isHidden || row.adminHidden) {
          return <Tag color="warning">Đã ẩn</Tag>;
        }
        return <Tag color="success">Hiển thị</Tag>;
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => {
        const id = record.id || record._id;
        const isDeleted = record.isDeleted || record.deletedAt;
        if (isDeleted) return '—';
        return (
          <RowActions
            onView={() => openReviewDetail(record)}
            onDelete={() => {
              setDeleteTarget(record);
              setDeleteReason('');
            }}
            deleteLoading={actionLoading === id}
          />
        );
      },
    },
  ];

  return (
    <PageContainer title="Đánh giá" subtitle="Kiểm duyệt đánh giá sản phẩm và shop">
      <ListToolbar
        searchPlaceholder="Tìm theo người đánh giá, sản phẩm..."
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        filters={[
          {
            key: 'status',
            placeholder: 'Trạng thái',
            options: STATUS_OPTIONS,
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
          },
          {
            key: 'rating',
            placeholder: 'Số sao',
            options: RATING_OPTIONS,
            value: rating,
            onChange: (v) => {
              setRating(v);
              setPage(1);
            },
          },
        ]}
        onReset={() => {
          setSearch('');
          setStatus(undefined);
          setRating(undefined);
          setPage(1);
        }}
      />

      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Table
        rowKey={(row) => row.id || row._id}
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} đánh giá`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />

      <AdminDetailModal
        open={Boolean(viewTarget)}
        onClose={() => {
          setViewTarget(null);
          setViewDetail(null);
        }}
        title="Chi tiết đánh giá"
        subtitle={viewDetail?.productName || viewDetail?.shopName || ''}
        loading={viewLoading}
        fullscreen
        footer={
          viewDetail && !(viewDetail.isDeleted || viewDetail.deletedAt) ? (
            <Space wrap className="admin-detail-modal-footer">
              <Button
                onClick={() => {
                  setViewTarget(null);
                  setDeleteTarget(viewDetail);
                  setDeleteReason('');
                }}
              >
                Xóa mềm
              </Button>
              <Button onClick={handleHideToggle} loading={actionLoading === (viewDetail.id || viewDetail._id)}>
                {viewDetail.isHidden || viewDetail.adminHidden ? 'Hiện lại' : 'Ẩn đánh giá'}
              </Button>
              {viewDetail.productId ? (
                <Button type="link" onClick={() => navigate(`/products/${viewDetail.productId}`)}>
                  Sản phẩm
                </Button>
              ) : null}
              {viewDetail.shopId ? (
                <Button type="link" onClick={() => navigate(`/sellers/shops/${viewDetail.shopId}`)}>
                  Gian hàng
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        <ReviewDetailPanel review={viewDetail} />
      </AdminDetailModal>

      <Modal
        title="Ẩn đánh giá"
        open={hideReasonOpen}
        okText="Ẩn"
        onOk={confirmHideReview}
        confirmLoading={Boolean(actionLoading)}
        onCancel={() => setHideReasonOpen(false)}
      >
        <Input.TextArea
          rows={3}
          placeholder="Lý do (bắt buộc)"
          value={hideReason}
          onChange={(e) => setHideReason(e.target.value)}
        />
      </Modal>

      <Modal
        title="Xóa đánh giá"
        open={Boolean(deleteTarget)}
        okText="Xóa"
        okButtonProps={{ danger: true, loading: Boolean(actionLoading) }}
        onOk={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteReason('');
        }}
      >
        <p>
          Xóa đánh giá của <strong>{deleteTarget?.reviewer?.fullName || 'người dùng'}</strong>?
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Lý do (bắt buộc)"
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
        />
      </Modal>
    </PageContainer>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Modal, Rate, Space, Table, Tag, message } from 'antd';

import { deleteAdminReview, getAdminReviewDetail, listAdminReviews } from '../../api/adminReviewApi';
import ReviewDetailPanel from '../components/ReviewDetailPanel';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ProductCell from '../components/ProductCell';
import ShopCell from '../components/ShopCell';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { formatDateTime } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  initialFilterValue,
  withAllFilterOption,
} from '../utils/filterOptions';
import { useAuth } from '../../context/AuthContext';
import { formatReservationOrderCodeShort } from '../../utils/reservationOrderCode';

const STATUS_OPTIONS = withAllFilterOption([
  { value: 'visible', label: 'Hiển thị' },
  { value: 'deleted', label: 'Đã xóa' },
]);

const REMOVED_BY_OPTIONS = withAllFilterOption([
  { value: 'admin', label: 'Admin xóa' },
  { value: 'buyer', label: 'Người dùng xóa' },
]);

const RATING_OPTIONS = withAllFilterOption([
  { value: '5', label: '5 sao' },
  { value: '4', label: '4 sao' },
  { value: '3', label: '3 sao' },
  { value: '2', label: '2 sao' },
  { value: '1', label: '1 sao' },
]);

export default function ReviewsPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => initialFilterValue(urlStatus));
  const [removedBy, setRemovedBy] = useState(ALL_FILTER_VALUE);
  const [rating, setRating] = useState(ALL_FILTER_VALUE);
  const [viewTarget, setViewTarget] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listAdminReviews(token, {
        page,
        limit,
        search,
        status: apiFilterParam(status),
        removedBy: status === 'deleted' ? apiFilterParam(removedBy) : undefined,
        rating: apiFilterParam(rating),
      });
      return {
        data: {
          items: payload.data?.items || [],
          pagination: payload.data?.pagination,
          stats: payload.data?.stats,
        },
      };
    },
    [getIdToken, search, status, removedBy, rating]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats, reload } =
    usePaginatedQuery({ fetcher, deps: [search, status, removedBy, rating] });

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng', value: stats?.total ?? 0 },
      { key: 'visible', title: 'Hiển thị', value: stats?.visible ?? 0 },
      { key: 'deleted', title: 'Đã xóa', value: stats?.deleted ?? 0 },
    ],
    [stats]
  );

  function closeReviewDetail() {
    setViewTarget(null);
    setViewDetail(null);
  }

  function navigateFromDetail(path) {
    closeReviewDetail();
    navigate(path);
  }

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
    { ...buildSttColumn({ page, pageSize: limit }), fixed: undefined },
    {
      title: 'Mã đơn',
      key: 'orderCode',
      width: 80,
      ellipsis: true,
      render: (_, row) => {
        const code = row.orderCode || formatReservationOrderCodeShort(row.reservationId);
        if (!code) return '—';
        if (row.reservationId) {
          return (
            <Link
              to={`/reservations/${row.reservationId}`}
              className="admin-reviews-order-code"
              title={code}
            >
              {code}
            </Link>
          );
        }
        return (
          <span className="admin-reviews-order-code" title={code}>
            {code}
          </span>
        );
      },
    },
    {
      title: 'Người đánh giá',
      key: 'reviewer',
      width: '15%',
      ellipsis: true,
      render: (_, row) => {
        const reviewer = row.reviewer;
        if (!reviewer) {
          return '—';
        }
        return (
          <ShopCell
            shopName={reviewer.fullName || reviewer.userName}
            shopUsername={reviewer.fullName ? reviewer.userName : ''}
            avatar={reviewer.avatar}
            onClick={reviewer.id ? () => navigate(`/users/${reviewer.id}`) : undefined}
          />
        );
      },
    },
    {
      title: 'Sản phẩm',
      key: 'product',
      width: 132,
      ellipsis: true,
      render: (_, row) => (
        <ProductCell
          productName={row.productName}
          productImage={row.productImage}
          onClick={row.productId ? () => navigate(`/products/${row.productId}`) : undefined}
        />
      ),
    },
    {
      title: 'Sao',
      dataIndex: 'rating',
      key: 'rating',
      width: 148,
      align: 'center',
      render: (v) => <Rate disabled allowHalf={false} value={Number(v) || 0} className="admin-reviews-rate" />,
    },
    {
      title: 'Nội dung',
      dataIndex: 'comment',
      key: 'comment',
      width: 96,
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Trạng thái',
      key: 'visibility',
      width: 108,
      align: 'center',
      render: (_, row) => {
        if (row.isDeleted || row.deletedAt) {
          if (row.isAdminRemoved || row.removedBy === 'admin') {
            return <Tag color="error">Admin xóa</Tag>;
          }
          if (row.isBuyerRemoved || row.removedBy === 'buyer') {
            return <Tag color="error">Người dùng xóa</Tag>;
          }
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
      width: 128,
      ellipsis: true,
      render: (v) => formatDateTime(v),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_, record) => {
        const id = record.id || record._id;
        const isDeleted = record.isDeleted || record.deletedAt;
        return (
          <RowActions
            onView={() => openReviewDetail(record)}
            onDelete={
              isDeleted
                ? undefined
                : () => {
                    setDeleteTarget(record);
                    setDeleteReason('');
                  }
            }
            deleteLoading={actionLoading === id}
          />
        );
      },
    },
  ];

  return (
    <PageContainer
      title="Đánh giá"
      subtitle="Kiểm duyệt đánh giá sản phẩm và shop"
      stats={<StatCards items={statItems} loading={loading && !stats} columns={3} />}
    >
      <ListToolbar
        searchPlaceholder="Tìm theo mã đơn, người đánh giá, sản phẩm..."
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
              if (v !== 'deleted') {
                setRemovedBy(ALL_FILTER_VALUE);
              }
              setPage(1);
            },
          },
          ...(status === 'deleted'
            ? [
                {
                  key: 'removedBy',
                  placeholder: 'Người xóa',
                  options: REMOVED_BY_OPTIONS,
                  value: removedBy,
                  onChange: (v) => {
                    setRemovedBy(v);
                    setPage(1);
                  },
                },
              ]
            : []),
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
          setStatus(ALL_FILTER_VALUE);
          setRemovedBy(ALL_FILTER_VALUE);
          setRating(ALL_FILTER_VALUE);
          setPage(1);
        }}
      />

      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Table
        className="admin-reviews-table"
        rowKey={(row) => row.id || row._id}
        loading={loading}
        columns={columns}
        dataSource={items}
        tableLayout="fixed"
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

      <Modal
        open={Boolean(viewTarget)}
        centered
        title="Chi tiết đánh giá"
        onCancel={closeReviewDetail}
        width={640}
        destroyOnClose
        footer={
          viewDetail && !(viewDetail.isDeleted || viewDetail.deletedAt) ? (
            <Space>
              <Button onClick={closeReviewDetail}>Đóng</Button>
              <Button
                danger
                loading={actionLoading === (viewDetail.id || viewDetail._id)}
                onClick={() => {
                  closeReviewDetail();
                  setDeleteTarget(viewDetail);
                  setDeleteReason('');
                }}
              >
                Xóa đánh giá
              </Button>
            </Space>
          ) : (
            <Button type="primary" onClick={closeReviewDetail}>
              Đóng
            </Button>
          )
        }
      >
        {viewLoading && !viewDetail ? (
          <p>Đang tải...</p>
        ) : (
          <ReviewDetailPanel review={viewDetail} onNavigate={navigateFromDetail} />
        )}
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

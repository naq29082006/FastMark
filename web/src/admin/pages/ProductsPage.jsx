import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Image, Input, Modal, Table, Tag, message } from 'antd';

import { deleteProduct, listProducts } from '../../api/catalogApi';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ShopCell from '../components/ShopCell';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { formatCurrency, formatDateTime } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

const STATUS_OPTIONS = [
  { value: '1', label: 'Đang hiện' },
  { value: '0', label: 'Đã ẩn' },
  { value: 'removed', label: 'Đã xóa' },
];

function productStatusTag(record) {
  if (record.isDeleted || record.isRemoved) {
    return <Tag color="error">{record.statusLabel || 'Đã xóa'}</Tag>;
  }
  if (record.status === 0) {
    return <Tag color="warning">{record.statusLabel || 'Đã ẩn'}</Tag>;
  }
  return <Tag color="success">{record.statusLabel || 'Đang hiện'}</Tag>;
}

function formatProductPrice(row) {
  if (row.isPromotion && row.promotionMinPrice != null) {
    const salePrice =
      row.promotionMaxPrice != null && row.promotionMaxPrice !== row.promotionMinPrice
        ? `${formatCurrency(row.promotionMinPrice)} - ${formatCurrency(row.promotionMaxPrice)}`
        : formatCurrency(row.promotionMinPrice);
    const originalPrice =
      row.priceLabel ||
      (row.maxPrice !== row.minPrice
        ? `${formatCurrency(row.minPrice)} - ${formatCurrency(row.maxPrice)}`
        : formatCurrency(row.minPrice));

    return (
      <div>
        <div style={{ color: '#dc2626', fontWeight: 600 }}>
          {salePrice}
          {row.discountLabel ? (
            <Tag color="red" style={{ marginLeft: 6 }}>
              {row.discountLabel}
            </Tag>
          ) : null}
        </div>
        <div style={{ color: '#9ca3af', textDecoration: 'line-through', fontSize: 12 }}>{originalPrice}</div>
      </div>
    );
  }

  if (row.priceLabel) {
    return row.priceLabel;
  }

  if (row.maxPrice != null && row.maxPrice !== row.minPrice) {
    return `${formatCurrency(row.minPrice)} - ${formatCurrency(row.maxPrice)}`;
  }

  return formatCurrency(row.minPrice ?? row.maxPrice ?? 0);
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(urlStatus);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listProducts(token, { page, limit, search, status });
      return {
        data: {
          items: payload.data?.items || [],
          pagination: payload.data?.pagination,
          stats: payload.data?.summary,
        },
      };
    },
    [getIdToken, search, status]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats, reload } =
    usePaginatedQuery({ fetcher, deps: [search, status] });

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng sản phẩm', value: stats?.total ?? 0 },
      { key: 'visible', title: 'Đang hiện', value: stats?.visible ?? 0 },
      { key: 'removed', title: 'Đã xóa', value: stats?.removed ?? 0 },
    ],
    [stats]
  );

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const id = deleteTarget.id || deleteTarget._id;
    setActionLoading(`delete-${id}`);
    try {
      const token = await getIdToken();
      await deleteProduct(token, id, { reason: deleteReason.trim() });
      message.success('Đã xóa sản phẩm');
      setDeleteTarget(null);
      setDeleteReason('');
      await reload();
    } catch (err) {
      message.error(err.message || 'Không xóa được sản phẩm');
    } finally {
      setActionLoading('');
    }
  }

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Ảnh',
      dataIndex: 'thumbnail',
      key: 'thumbnail',
      width: 72,
      render: (thumb) =>
        thumb ? (
          <Image
            src={resolveMediaUrl(thumb)}
            alt=""
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 6 }}
          />
        ) : (
          '—'
        ),
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'productName',
      key: 'productName',
      render: (v) => v || '—',
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
      title: 'Danh mục',
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (v) => v || '—',
    },
    {
      title: 'Giá',
      key: 'price',
      render: (_, row) => formatProductPrice(row),
    },
    {
      title: 'Tồn kho',
      key: 'stock',
      render: (_, row) => row.stock ?? row.totalStock ?? 0,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, record) => productStatusTag(record),
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
        const isRemoved = record.isDeleted || record.isRemoved;
        return (
          <RowActions
            onView={() => navigate(`/products/${id}`)}
            onDelete={
              isRemoved
                ? undefined
                : () => {
                    setDeleteTarget(record);
                    setDeleteReason('');
                  }
            }
            deleteLoading={actionLoading === `delete-${id}`}
          />
        );
      },
    },
  ];

  return (
    <PageContainer
      title="Sản phẩm"
      subtitle="Quản lý sản phẩm trên toàn hệ thống"
      stats={<StatCards items={statItems} loading={loading && !stats} columns={3} />}
    >
      <ListToolbar
        searchPlaceholder="Tìm theo tên sản phẩm, shop..."
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
        ]}
        onReset={() => {
          setSearch('');
          setStatus(undefined);
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
          showTotal: (total) => `${total} sản phẩm`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />

      <Modal
        title="Xóa sản phẩm"
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
          Xóa sản phẩm <strong>{deleteTarget?.productName}</strong>? Hành động này không thể hoàn tác.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Lý do xóa (tuỳ chọn)"
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
        />
      </Modal>
    </PageContainer>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Modal, Table, Tag, message } from 'antd';

import { deleteProduct, listProducts } from '../../api/catalogApi';
import { listCategories } from '../../api/categoryApi';
import PreviewableImage from '../../components/PreviewableImage';
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
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  initialFilterValue,
  withAllFilterOption,
} from '../utils/filterOptions';

const STATUS_OPTIONS = withAllFilterOption([
  { value: '1', label: 'Đang hiện' },
  { value: '0', label: 'Đã ẩn' },
  { value: 'removed', label: 'Đã xóa' },
]);

const REMOVED_BY_OPTIONS = withAllFilterOption([
  { value: 'admin', label: 'Admin xóa' },
  { value: 'seller', label: 'Người bán xóa' },
]);

function productStatusTag(record) {
  if (record.isDeleted || record.isRemoved) {
    if (record.isAdminRemoved || record.removedBy === 'admin') {
      return <Tag color="error">Admin xóa</Tag>;
    }
    if (record.isSellerRemoved || record.removedBy === 'seller') {
      return <Tag color="error">Người bán xóa</Tag>;
    }
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

function productListCell(name, thumbnail) {
  const label = name || '—';
  return (
    <div className="admin-dashboard-product-cell">
      <PreviewableImage
        src={thumbnail}
        alt={label}
        width={40}
        height={40}
        shape="rounded"
        fallbackLetter={label}
        className="admin-dashboard-product-cell-thumb"
      />
      <span className="admin-dashboard-product-cell-name" title={label}>
        {label}
      </span>
    </div>
  );
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const urlCategoryId = useUrlQueryString('categoryId');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => initialFilterValue(urlStatus));
  const [removedBy, setRemovedBy] = useState(ALL_FILTER_VALUE);
  const [categoryId, setCategoryId] = useState(() => initialFilterValue(urlCategoryId));
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setCategoriesLoading(true);
      try {
        const token = await getIdToken();
        const payload = await listCategories(token, 'products');
        if (cancelled) return;
        const rows = payload.data?.categories || payload.data?.items || [];
        setCategoryOptions(
          withAllFilterOption(
            rows.map((item) => ({
              value: String(item.id || item._id),
              label: item.name || item.categoryName || '—',
            }))
          )
        );
      } catch {
        if (!cancelled) {
          setCategoryOptions(withAllFilterOption([]));
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listProducts(token, {
        page,
        limit,
        search,
        status: apiFilterParam(status),
        removedBy: status === 'removed' ? apiFilterParam(removedBy) : undefined,
        categoryId: apiFilterParam(categoryId),
      });
      return {
        data: {
          items: payload.data?.items || [],
          pagination: payload.data?.pagination,
          stats: payload.data?.summary,
        },
      };
    },
    [getIdToken, search, status, removedBy, categoryId]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats, reload } =
    usePaginatedQuery({ fetcher, deps: [search, status, removedBy, categoryId] });

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng sản phẩm', value: stats?.total ?? 0 },
      {
        key: 'visible',
        title: 'Đang hiện',
        value: stats?.visible ?? 0,
        onClick: () => {
          setStatus('1');
          setPage(1);
        },
      },
      {
        key: 'hidden',
        title: 'Đã ẩn',
        value: stats?.hidden ?? 0,
        onClick: () => {
          setStatus('0');
          setPage(1);
        },
      },
      {
        key: 'removed',
        title: 'Đã xóa',
        value: stats?.removed ?? 0,
        onClick: () => {
          setStatus('removed');
          setPage(1);
        },
      },
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
      title: 'Sản phẩm',
      key: 'product',
      width: 200,
      render: (_, row) => productListCell(row.productName, row.thumbnail),
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
      width: 168,
      render: (_, row) => formatProductPrice(row),
    },
    {
      title: 'Tồn kho',
      key: 'stock',
      width: 92,
      align: 'center',
      render: (_, row) => row.stock ?? row.totalStock ?? 0,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 118,
      align: 'center',
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
      stats={<StatCards items={statItems} loading={loading && !stats} columns={4} />}
    >
      <ListToolbar
        searchPlaceholder="Tìm theo tên sản phẩm, shop..."
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        filters={[
          {
            key: 'category',
            placeholder: 'Danh mục',
            options: categoryOptions,
            value: categoryId,
            loading: categoriesLoading,
            onChange: (v) => {
              setCategoryId(v);
              setPage(1);
            },
          },
          {
            key: 'status',
            placeholder: 'Trạng thái',
            options: STATUS_OPTIONS,
            value: status,
            onChange: (v) => {
              setStatus(v);
              if (v !== 'removed') {
                setRemovedBy(ALL_FILTER_VALUE);
              }
              setPage(1);
            },
          },
          ...(status === 'removed'
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
        ]}
        onReset={() => {
          setSearch('');
          setCategoryId(ALL_FILTER_VALUE);
          setStatus(ALL_FILTER_VALUE);
          setRemovedBy(ALL_FILTER_VALUE);
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

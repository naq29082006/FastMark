import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Image, Space, Table, Tag } from 'antd';

import { getReservationStats, listReservations } from '../../api/reservationAdminApi';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ShopCell from '../components/ShopCell';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { formatCurrency, formatDateTime, reservationStatusLabel } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'holding', label: 'Giữ hàng' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'dispute', label: 'Tranh chấp' },
  { value: 'cancelled', label: 'Đã hủy' },
];

function buildListParams({ page, limit, search, statusFilter }) {
  const params = { page, limit, search };
  if (statusFilter === 'pending') params.tab = 'pending';
  else if (statusFilter === 'holding') params.tab = 'waiting_pickup';
  else if (statusFilter === 'completed') params.tab = 'completed';
  else if (statusFilter === 'dispute') params.tab = 'dispute';
  else if (statusFilter === 'cancelled') params.tab = 'cancelled';
  return params;
}

function statusColor(status) {
  if (status === 3 || status === 5) return 'success';
  if (status === 4) return 'error';
  if (status === 6 || status === 1) return 'default';
  return 'processing';
}

function resolveTotalPrice(item) {
  const unit = Number(item?.agreedPrice ?? item?.reservedPrice) || 0;
  const qty = Number(item?.quantity) || 0;
  return unit * qty;
}

export default function ReservationsPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(urlStatus);
  const [reservationStats, setReservationStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      return listReservations(token, buildListParams({ page, limit, search, statusFilter: status }));
    },
    [getIdToken, search, status]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit } = usePaginatedQuery({
    fetcher,
    deps: [search, status],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const token = await getIdToken();
        const payload = await getReservationStats(token);
        if (!cancelled) {
          setReservationStats(payload.data?.stats || null);
        }
      } catch {
        if (!cancelled) setReservationStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const statItems = useMemo(() => {
    const s = reservationStats || {};
    return [
      { key: 'total', title: 'Tổng đơn', value: s.total ?? 0 },
      { key: 'pending', title: 'Chờ xác nhận', value: s.pendingSellerConfirmation ?? 0 },
      { key: 'holding', title: 'Giữ hàng', value: s.waitingPickup ?? 0 },
      {
        key: 'completed',
        title: 'Hoàn thành',
        value: s.completedAll ?? (s.completed ?? 0) + (s.autoCompleted ?? 0) + (s.received ?? 0),
      },
      { key: 'disputed', title: 'Tranh chấp', value: s.disputed ?? 0 },
      { key: 'cancelled', title: 'Đã hủy', value: s.cancelled ?? 0 },
    ];
  }, [reservationStats]);

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Mã đơn',
      dataIndex: 'code',
      key: 'code',
      render: (v, row) => v || `#${String(row.id || row._id || '').slice(-8).toUpperCase()}`,
    },
    {
      title: 'Người mua',
      key: 'buyer',
      render: (_, row) => row.buyer?.fullName || row.buyer?.userName || '—',
    },
    {
      title: 'Gian hàng',
      key: 'shop',
      width: 220,
      render: (_, row) => (
        <ShopCell
          shopName={row.shop?.shopName || row.shopName}
          shopUsername={row.shop?.shopUsername || row.shopUsername}
          shopAvatar={row.shop?.avatar || row.shopAvatar}
          onClick={
            row.shop?.id || row.shopId
              ? () => navigate(`/sellers/shops/${row.shop?.id || row.shopId}`)
              : undefined
          }
        />
      ),
    },
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, row) => {
        const name = row.product?.productName || row.productName || '—';
        const thumb = resolveMediaUrl(row.product?.thumbnail);
        return (
          <Space>
            {thumb ? (
              <Image src={thumb} alt="" width={36} height={36} style={{ objectFit: 'cover', borderRadius: 4 }} />
            ) : null}
            <span>{name}</span>
          </Space>
        );
      },
    },
    {
      title: 'Tổng tiền',
      key: 'total',
      render: (_, row) => formatCurrency(resolveTotalPrice(row)),
    },
    {
      title: 'Cọc',
      dataIndex: 'depositAmount',
      key: 'depositAmount',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (v, row) => (
        <Tag color={statusColor(v)}>{row.statusLabel || reservationStatusLabel(v)}</Tag>
      ),
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
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <RowActions onView={() => navigate(`/reservations/${record.id || record._id}`)} />
      ),
    },
  ];

  return (
    <PageContainer
      title="Đơn hàng"
      subtitle="Theo dõi và xử lý đơn hàng trên hệ thống"
      stats={<StatCards items={statItems} loading={statsLoading} columns={6} />}
    >
      <ListToolbar
        searchPlaceholder="Tìm theo mã đơn, người mua, shop..."
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
          showTotal: (total) => `${total} đơn`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />
    </PageContainer>
  );
}

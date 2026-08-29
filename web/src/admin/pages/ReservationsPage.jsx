import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Table, Tag } from 'antd';

import { getReservationStats, listReservations } from '../../api/reservationAdminApi';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ShopCell from '../components/ShopCell';
import ProductCell from '../components/ProductCell';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { useAdminRealtimeRefresh } from '../../hooks/useAdminRealtimeRefresh';
import { formatCurrency, formatDateTime } from '../utils/format';
import { resolveAdminReservationStatusMeta } from '../../utils/adminReservationStatus';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';
import { resolvePageTitle } from '../config/menu';
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  initialFilterValue,
  withAllFilterOption,
} from '../utils/filterOptions';

const STATUS_OPTIONS = withAllFilterOption([
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'holding', label: 'Giữ hàng' },
  { value: 'pickup_confirmed', label: 'Đã nhận hàng' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'dispute', label: 'Tranh chấp' },
  { value: 'dispute_resolved', label: 'Tranh chấp đã xử lý' },
  { value: 'cancelled', label: 'Đã hủy' },
]);

const DISPUTE_VIEW_OPTIONS = [
  { value: 'pending', label: 'Cần xử lý' },
  { value: 'history', label: 'Lịch sử tranh chấp' },
];

function buildListParams({ page, limit, search, statusFilter, listTab, disputeView }) {
  const params = { page, limit, search };
  if (listTab === 'dispute_admin') {
    params.tab = disputeView === 'history' ? 'dispute_admin_history' : 'dispute_admin';
    return params;
  }
  const status = apiFilterParam(statusFilter);
  if (status === 'pending') params.tab = 'pending';
  else if (status === 'holding') params.tab = 'waiting_pickup';
  else if (status === 'pickup_confirmed') params.tab = 'pickup_confirmed';
  else if (status === 'completed') params.tab = 'completed';
  else if (status === 'dispute') params.tab = 'dispute_active';
  else if (status === 'dispute_resolved') params.tab = 'dispute_resolved';
  else if (status === 'cancelled') params.tab = 'cancelled';
  return params;
}

function statusTagColor(row) {
  return resolveAdminReservationStatusMeta(row).tagColor;
}

function statusTagLabel(row) {
  return row.statusLabel || resolveAdminReservationStatusMeta(row).label;
}

function resolveTotalPrice(item) {
  const unit = Number(item?.agreedPrice ?? item?.reservedPrice) || 0;
  const qty = Number(item?.quantity) || 0;
  return unit * qty;
}

function productListCell(name, thumbnail, onClick) {
  return <ProductCell productName={name} productImage={thumbnail} onClick={onClick} />;
}

function renderDepositCell(row) {
  const deposit = Number(row.depositAmount) || 0;
  const total = resolveTotalPrice(row);
  const percent = total > 0 ? Math.round((deposit / total) * 100) : null;
  return (
    <span className="admin-reservation-deposit-cell">
      {formatCurrency(deposit)}
      {percent != null ? <span className="admin-reservation-deposit-pct"> ({percent}%)</span> : null}
    </span>
  );
}

export default function ReservationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getIdToken } = useAuth();
  const listTab = searchParams.get('tab') === 'dispute_admin' ? 'dispute_admin' : 'all';
  const isDisputeAdminTab = listTab === 'dispute_admin';
  const disputeView = searchParams.get('view') === 'history' ? 'history' : 'pending';
  const isDisputeHistoryView = isDisputeAdminTab && disputeView === 'history';
  const pageTitle = resolvePageTitle('/reservations', searchParams);
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => initialFilterValue(urlStatus));
  const [reservationStats, setReservationStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      return listReservations(
        token,
        buildListParams({ page, limit, search, statusFilter: status, listTab, disputeView })
      );
    },
    [getIdToken, search, status, listTab, disputeView]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, reload } =
    usePaginatedQuery({
    fetcher,
    deps: [search, status, listTab, disputeView],
  });

  const applyStatusFilter = useCallback(
    (nextStatus) => {
      setStatus(nextStatus);
      setPage(1);
    },
    [setPage]
  );

  const activeStatusLabel = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === status)?.label || '',
    [status]
  );

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const token = await getIdToken();
      const payload = await getReservationStats(token);
      setReservationStats(payload.data?.stats || null);
    } catch {
      setReservationStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const refreshFromRealtime = useCallback(() => {
    reload({ silent: true });
    loadStats();
  }, [reload, loadStats]);

  useAdminRealtimeRefresh('order', refreshFromRealtime, {
    enabled: true,
    coalesceMs: 1000,
  });

  const statItems = useMemo(() => {
    const s = reservationStats || {};
    return [
      { key: 'total', title: 'Tổng đơn', value: s.total ?? 0 },
      { key: 'pending', title: 'Chờ xác nhận', value: s.pendingSellerConfirmation ?? 0 },
      { key: 'holding', title: 'Giữ hàng', value: s.waitingPickup ?? 0 },
      { key: 'received', title: 'Đã nhận hàng', value: s.received ?? 0 },
      { key: 'completed', title: 'Hoàn thành', value: s.completed ?? 0 },
      { key: 'disputed', title: 'Tranh chấp', value: s.disputed ?? 0 },
      { key: 'disputeResolved', title: 'Tranh chấp đã xử lý', value: s.disputeResolved ?? 0 },
      { key: 'cancelled', title: 'Đã hủy', value: s.cancelled ?? 0 },
    ];
  }, [reservationStats]);

  const partyColumnWidth = 200;

  const columns = useMemo(() => {
    const base = [
      buildSttColumn({ page, pageSize: limit }),
      {
        title: 'Mã đơn',
        dataIndex: 'code',
        key: 'code',
        width: 96,
        ellipsis: true,
        render: (v, row) => {
          const code = v || `#${String(row.id || row._id || '').slice(-8).toUpperCase()}`;
          return (
            <span title={code} style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
              {code}
            </span>
          );
        },
      },
      {
        title: 'Người mua',
        key: 'buyer',
        width: partyColumnWidth,
        ellipsis: true,
        render: (_, row) => {
          const buyer = row.buyer;
          if (!buyer) return '—';
          const accountId = buyer.id || row.userId;
          return (
            <ShopCell
              shopName={buyer.fullName || buyer.userName}
              shopUsername={buyer.fullName ? buyer.userName : ''}
              shopAvatar={buyer.avatar}
              onClick={accountId ? () => navigate(`/users/${accountId}`) : undefined}
            />
          );
        },
      },
      {
        title: 'Gian hàng',
        key: 'shop',
        width: partyColumnWidth,
        ellipsis: true,
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
        width: partyColumnWidth - 15,
        ellipsis: true,
        render: (_, row) => {
          const productId = row.product?.id || row.productId;
          return productListCell(
            row.product?.productName || row.productName,
            row.product?.thumbnail || row.productThumbnail,
            productId ? () => navigate(`/products/${productId}`) : undefined
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
        render: (_, row) => renderDepositCell(row),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        render: (_, row) => (
          <Tag color={statusTagColor(row)}>{statusTagLabel(row)}</Tag>
        ),
      },
    ];

    if (isDisputeHistoryView) {
      base.push({
        title: 'Ngày xử lý',
        key: 'disputeResolvedAt',
        render: (_, row) => formatDateTime(row.disputeResolvedAt || row.tgGiaiCoc),
      });
    } else {
      base.push({
        title: 'Ngày tạo',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: formatDateTime,
      });
    }

    base.push({
      title: 'Thao tác',
      key: 'actions',
      width: 95,
      fixed: 'right',
      render: (_, record) => (
        <RowActions onView={() => navigate(`/reservations/${record.id || record._id}`)} />
      ),
    });

    return base;
  }, [isDisputeHistoryView, limit, navigate, page]);

  function handleDisputeViewChange(nextView) {
    setPage(1);
    if (nextView === 'history') {
      navigate({ pathname: '/reservations', search: 'tab=dispute_admin&view=history' });
      return;
    }
    navigate({ pathname: '/reservations', search: 'tab=dispute_admin' });
  }

  return (
    <PageContainer
      title={pageTitle}
      subtitle={
        isDisputeAdminTab
          ? isDisputeHistoryView
            ? 'Các đơn tranh chấp đã được xử lý (admin và tự động hoàn tiền)'
            : 'Đơn tranh chấp khi cả người mua và người bán đã báo cáo, chờ admin xử lý'
          : 'Theo dõi và xử lý đơn hàng trên hệ thống'
      }
      stats={isDisputeAdminTab ? null : <StatCards items={statItems} loading={statsLoading} columns={4} />}
    >
      <ListToolbar
        searchPlaceholder="Tìm theo mã đơn, người mua, shop..."
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        filters={
          isDisputeAdminTab
            ? [
                {
                  key: 'disputeView',
                  placeholder: 'Loại tranh chấp',
                  options: DISPUTE_VIEW_OPTIONS,
                  value: disputeView,
                  onChange: handleDisputeViewChange,
                },
              ]
            : [
                {
                  key: 'status',
                  placeholder: 'Trạng thái',
                  options: STATUS_OPTIONS,
                  value: status,
                  onChange: (v) => {
                    applyStatusFilter(v);
                  },
                },
              ]
        }
        onReset={() => {
          setSearch('');
          if (isDisputeAdminTab) {
            if (disputeView !== 'pending') {
              navigate({ pathname: '/reservations', search: 'tab=dispute_admin' });
            }
          } else {
            applyStatusFilter(ALL_FILTER_VALUE);
          }
        }}
      />

      {!loading && status !== ALL_FILTER_VALUE && items.length === 0 && !error ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Không có đơn với trạng thái "${activeStatusLabel}".`}
          action={
            <Button size="small" type="link" onClick={() => applyStatusFilter(ALL_FILTER_VALUE)}>
              Xem tất cả đơn
            </Button>
          }
        />
      ) : null}

      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Table
        rowKey={(row) => row.id || row._id}
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 900 }}
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

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  ShoppingBag,
  XCircle,
} from 'lucide-react';

import {
  getReservationStats,
  listReservations,
} from '../api/reservationAdminApi';
import AdminDetailTabs from '../components/admin/AdminDetailTabs';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminPageShell from '../components/admin/AdminPageShell';
import AdminPagination from '../components/admin/AdminPagination';
import DataTableShell from '../components/admin/DataTableShell';
import { TableSttCell, TableSttHeader } from '../components/admin/TableStt';
import TableIconActions from '../components/ui/TableIconActions';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import { EmptyState } from '../components/ui/Feedback';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminOrderSocket } from '../hooks/useAdminOrderSocket';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { formatDateActivity, formatPrice } from '../utils/format';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import PreviewableImage from '../components/PreviewableImage';
import { keepIfSame, mergeListById } from '../utils/realtimeList';
import { resolveAdminListStatusMeta } from '../utils/reservationOrderTimeline';

const STATUS_LABELS = {
  0: 'Chờ shop xác nhận',
  1: 'Đã từ chối',
  2: 'Chờ nhận hàng',
  3: 'Hoàn thành',
  4: 'Tranh chấp',
  5: 'Tự hoàn thành',
  6: 'Đã hủy (hoàn cọc)',
  7: 'Đã hủy (tranh chấp)',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '0', label: STATUS_LABELS[0] },
  { value: '1', label: STATUS_LABELS[1] },
  { value: '2', label: STATUS_LABELS[2] },
  { value: '3', label: STATUS_LABELS[3] },
  { value: '4', label: STATUS_LABELS[4] },
  { value: '5', label: STATUS_LABELS[5] },
  { value: '6', label: STATUS_LABELS[6] },
  { value: '7', label: STATUS_LABELS[7] },
];

const TABS = [
  { id: 'all', label: 'Tất cả', tabParam: '', statsKey: 'total' },
  {
    id: 'pending',
    label: 'Chờ xác nhận',
    tabParam: 'pending',
    statsKey: 'pendingSellerConfirmation',
  },
  {
    id: 'waiting',
    label: 'Giữ hàng',
    tabParam: 'waiting_pickup',
    statsKey: 'waitingPickup',
  },
  {
    id: 'received',
    label: 'Đã nhận hàng',
    tabParam: 'pickup_confirmed',
    statsKey: 'received',
  },
  {
    id: 'completed',
    label: 'Hoàn thành',
    tabParam: 'completed',
    statsKey: 'completed',
  },
  {
    id: 'disputes',
    label: 'Tranh chấp',
    tabParam: 'dispute_active',
    statsKey: 'disputed',
  },
  {
    id: 'disputeResolved',
    label: 'Tranh chấp đã xử lý',
    tabParam: 'dispute_resolved',
    statsKey: 'disputeResolved',
  },
  { id: 'cancelled', label: 'Đã hủy', tabParam: 'cancelled', statsKey: 'cancelled' },
];

const EMPTY_STATS = {
  total: 0,
  waitingPickup: 0,
  received: 0,
  completed: 0,
  autoCompleted: 0,
  completedAll: 0,
  disputed: 0,
  disputeResolved: 0,
  refunded: 0,
  cancelled: 0,
  pendingSellerConfirmation: 0,
  sellerCancelledAfterAccept: 0,
};

function normalizeTab(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return 'all';
  if (
    value === 'pending' ||
    value === 'pending_confirmation' ||
    value === 'waiting_confirmation'
  ) {
    return 'pending';
  }
  if (value === 'disputes' || value === 'dispute' || value === 'dispute_active') return 'disputes';
  if (value === 'dispute_resolved' || value === 'dispute_resolved_history') return 'disputeResolved';
  if (value === 'waiting' || value === 'waiting_pickup') return 'waiting';
  if (value === 'received' || value === 'pickup_confirmed') return 'received';
  if (value === 'completed' || value === 'auto' || value === 'auto_completed') return 'completed';
  if (
    value === 'cancelled' ||
    value === 'canceled' ||
    value === 'seller_cancelled' ||
    value === 'seller_cancel_after_accept'
  ) {
    return 'cancelled';
  }
  return 'all';
}

function resolveListStatusMeta(item) {
  return resolveAdminListStatusMeta(item);
}

function resolveTotalPrice(item) {
  const unit = Number(item?.agreedPrice ?? item?.reservedPrice) || 0;
  const qty = Number(item?.quantity) || 0;
  return unit * qty;
}

function DateTimeCell({ value }) {
  const formatted = formatDateActivity(value);
  if (!formatted) return <span className="muted">—</span>;
  return (
    <div className="datetime-cell">
      <span className="datetime-cell-time">{formatted.time}</span>
      <span className="datetime-cell-day">{formatted.day}</span>
    </div>
  );
}

function PartyNameCell({ name, handle }) {
  return (
    <div className="order-party-name-cell">
      <div className="cell-title">{name || '—'}</div>
      {handle ? <div className="cell-sub">@{handle}</div> : null}
    </div>
  );
}

function ProductCell({ item }) {
  const name = item.product?.productName || 'Sản phẩm';
  const thumb = resolveMediaUrl(item.product?.thumbnail);

  return (
    <div className="order-product-cell">
      {thumb ? (
        <img src={thumb} alt="" className="order-product-thumb" />
      ) : (
        <span className="order-product-thumb placeholder">SP</span>
      )}
      <div className="order-product-meta">
        <strong>{name}</strong>
        <span>SL: {item.quantity || 0}</span>
      </div>
    </div>
  );
}

/** Hàng đơn hàng được memo: realtime chỉ render lại đúng đơn vừa đổi. */
const ReservationRow = memo(function ReservationRow({ item, page, limit, index, onView }) {
  const statusMeta = resolveListStatusMeta(item);

  return (
    <tr className="orders-table-row">
      <TableSttCell page={page} limit={limit} index={index} />
      <td>
        <div className="cell-title mono-code">
          #{item.code || String(item.id).slice(-8).toUpperCase()}
        </div>
      </td>
      <td>
        <PartyNameCell
          name={item.buyer?.fullName || item.buyer?.userName}
          handle={item.buyer?.userName}
        />
      </td>
      <td>
        <PartyNameCell name={item.shop?.shopName} handle={item.shop?.shopUsername} />
      </td>
      <td>
        <ProductCell item={item} />
      </td>
      <td className="cell-price">{formatPrice(resolveTotalPrice(item))}</td>
      <td className="cell-price">{formatPrice(item.depositAmount)}</td>
      <td>
        <DateTimeCell value={item.createdAt} />
      </td>
      <td>
        <DateTimeCell value={item.pickupTime} />
      </td>
      <td>
        <span className={statusMeta.className}>{statusMeta.label}</span>
      </td>
      <td className="col-actions">
        <TableIconActions
          actions={[
            {
              icon: Eye,
              label: 'Xem chi tiết',
              onClick: () => onView?.(item.id),
            },
          ]}
        />
      </td>
    </tr>
  );
});

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <tr key={index}>
          <td colSpan={11}>
            <div className="skeleton skeleton-line" style={{ height: 44 }} />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function ReservationsPage() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = normalizeTab(searchParams.get('tab'));

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [, setClockTick] = useState(0);
  const realtimeTimerRef = useRef(null);
  // Ref để handler realtime luôn gọi bản loadItems mới nhất mà không cần re-subscribe.
  const loadItemsRef = useRef(null);

  useEffect(() => {
    const timerId = setInterval(() => setClockTick((value) => value + 1), 30000);
    return () => clearInterval(timerId);
  }, []);

  const activeTabConfig = useMemo(
    () => TABS.find((tab) => tab.id === activeTab) || TABS[0],
    [activeTab]
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setDateFrom('');
    setDateTo('');
    setDatePreset('all');
    setPage(1);
  }, [activeTab]);

  const loadItems = useCallback(async ({ silent = false } = {}) => {
    // silent = đồng bộ realtime: không bật skeleton, chỉ hàng nào đổi mới render lại.
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const token = await getIdToken();
      const params = {
        search,
        page,
        limit,
        dateFrom,
        dateTo,
      };
      if (activeTabConfig.tabParam) {
        params.tab = activeTabConfig.tabParam;
      } else if (status !== '') {
        params.status = status;
      }

      const [listPayload, statsPayload] = await Promise.all([
        listReservations(token, params),
        getReservationStats(token),
      ]);
      setItems((current) => mergeListById(current, listPayload.data?.items || []));
      setPagination((current) =>
        keepIfSame(
          current,
          listPayload.data?.pagination || {
            page: 1,
            limit: DEFAULT_PAGE_SIZE,
            total: 0,
            totalPages: 1,
          }
        )
      );
      const nextStats = statsPayload.data?.stats || EMPTY_STATS;
      setStats((current) =>
        keepIfSame(current, {
          ...EMPTY_STATS,
          ...nextStats,
          completedAll:
            nextStats.completedAll ??
            (Number(nextStats.completed) || 0) + (Number(nextStats.autoCompleted) || 0),
          cancelled:
            nextStats.cancelled ??
            (Number(nextStats.rejected) || 0) +
              (Number(nextStats.refunded) || 0) +
              (Number(nextStats.disputeResolved) || 0),
        })
      );
    } catch (loadError) {
      if (silent) {
        // Đồng bộ nền lỗi: giữ nguyên bảng đang xem, không báo lỗi, không nháy.
        return;
      }
      setError(loadError.message || 'Không tải được danh sách đơn giữ hàng.');
      setItems([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [activeTabConfig.tabParam, dateFrom, dateTo, getIdToken, limit, page, search, status]);

  useEffect(() => {
    loadItemsRef.current = loadItems;
  }, [loadItems]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  /**
   * Admin nhận event của mọi đơn trong hệ thống → gộp lại và đồng bộ im lặng.
   * Chỉ dòng có dữ liệu thay đổi (và các ô thống kê) được render lại.
   */
  const handleOrderUpdated = useCallback(() => {
    if (realtimeTimerRef.current) {
      return;
    }
    realtimeTimerRef.current = setTimeout(() => {
      realtimeTimerRef.current = null;
      loadItemsRef.current?.({ silent: true });
    }, REALTIME_COALESCE_MS);
  }, []);

  useEffect(
    () => () => {
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    },
    []
  );

  useAdminOrderSocket({
    enabled: true,
    getIdToken,
    onOrderUpdated: handleOrderUpdated,
  });

  const handleViewReservation = useCallback(
    (reservationId) => {
      navigate(`/reservations/${reservationId}`);
    },
    [navigate]
  );

  function setTab(tabId) {
    const next = normalizeTab(tabId);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'all') {
      nextParams.delete('tab');
    } else {
      const config = TABS.find((tab) => tab.id === next);
      nextParams.set('tab', config?.tabParam || next);
    }
    setSearchParams(nextParams, { replace: true });
    setPage(1);
    setDateFrom('');
    setDateTo('');
    setDatePreset('all');
    if (next !== 'all') {
      setStatus('');
    }
  }

  const tabItems = useMemo(
    () =>
      TABS.map((tab) => ({
        id: tab.id,
        label: `${tab.label} (${Number(stats[tab.statsKey]) || 0})`,
      })),
    [stats]
  );

  const statCards = [
    {
      label: 'Tất cả',
      value: loading ? '…' : stats.total,
      icon: ShoppingBag,
      tone: 'green',
      onClick: () => setTab('all'),
      active: activeTab === 'all',
    },
    {
      label: 'Chờ xác nhận',
      value: loading ? '…' : stats.pendingSellerConfirmation,
      icon: Clock,
      tone: 'blue',
      onClick: () => setTab('pending'),
      active: activeTab === 'pending',
    },
    {
      label: 'Giữ hàng',
      value: loading ? '…' : stats.waitingPickup,
      icon: ShoppingBag,
      tone: 'slate',
      onClick: () => setTab('waiting'),
      active: activeTab === 'waiting',
    },
    {
      label: 'Tranh chấp',
      value: loading ? '…' : stats.disputed,
      icon: AlertTriangle,
      tone: 'amber',
      onClick: () => setTab('disputes'),
      active: activeTab === 'disputes',
    },
    {
      label: 'Hoàn thành',
      value: loading ? '…' : stats.completedAll,
      icon: CheckCircle,
      tone: 'green',
      onClick: () => setTab('completed'),
      active: activeTab === 'completed',
    },
    {
      label: 'Đã hủy',
      value: loading ? '…' : stats.cancelled,
      icon: XCircle,
      tone: 'red',
      onClick: () => setTab('cancelled'),
      active: activeTab === 'cancelled',
    },
  ];

  return (
    <AdminPageShell stats={statCards}>
      {error ? <p className="error-banner">{error}</p> : null}

      <DataTableShell
        title="Danh sách đơn hàng"
        filterColumns={3}
        filters={
          <AdminFilterPanel
            layout="inline"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Mã đơn, khách hàng, gian hàng, lý do tranh chấp..."
          >
            <label>
              Trạng thái
              <select
                value={status}
                disabled={activeTab !== 'all'}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <AdminDateFilter
              from={dateFrom}
              to={dateTo}
              preset={datePreset}
              onApply={(range) => {
                setDateFrom(range.from || '');
                setDateTo(range.to || '');
                setDatePreset(range.preset || (!range.from && !range.to ? 'all' : 'custom'));
                setPage(1);
              }}
            />
          </AdminFilterPanel>
        }
        pagination={
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            label="đơn"
            limit={limit}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            loading={loading}
            onPageChange={setPage}
          />
        }
      >
        <div className="orders-table-tabs">
          <AdminDetailTabs tabs={tabItems} activeTab={activeTab} onChange={setTab} variant="underline" />
        </div>

        {!loading && items.length === 0 ? (
          <EmptyState
            icon="📦"
            title="Không có đơn hàng"
            description="Thử đổi tab, bộ lọc hoặc khoảng thời gian."
          />
        ) : (
          <div className="orders-table-scroll">
            <table className="data-table orders-table admin-data-table">
              <thead>
                <tr>
                  <TableSttHeader />
                  <th>Mã đơn</th>
                  <th>Người mua</th>
                  <th>Người bán</th>
                  <th>Sản phẩm</th>
                  <th>Tổng tiền</th>
                  <th>Tiền cọc</th>
                  <th>Giờ đặt</th>
                  <th>Giờ nhận</th>
                  <th>Trạng thái</th>
                  <th className="col-actions" aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : (
                  items.map((item, index) => (
                    <ReservationRow
                      key={item.id}
                      item={item}
                      page={pagination.page}
                      limit={limit}
                      index={index}
                      onView={handleViewReservation}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </DataTableShell>
    </AdminPageShell>
  );
}

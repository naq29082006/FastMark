import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Lock, Unlock, UserCheck, UserX } from 'lucide-react';
import FastMarkShopPinIcon from '../components/icons/FastMarkShopPinIcon';

import { blockShop, listShops, unblockShop } from '../api/catalogApi';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminPageShell from '../components/admin/AdminPageShell';
import AdminPagination from '../components/admin/AdminPagination';
import DataTableShell from '../components/admin/DataTableShell';
import { TableSttCell, TableSttHeader } from '../components/admin/TableStt';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { formatDate } from '../utils/format';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Hoạt động' },
  { value: '0', label: 'Đã khóa' },
];

const OPEN_OPTIONS = [
  { value: '', label: 'Tất cả mở/đóng' },
  { value: '1', label: 'Đang mở' },
  { value: '0', label: 'Đóng cửa' },
];

export default function ShopsPage() {
  const { getIdToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterFromUrl = searchParams.get('filter') || '';
  const statusFromUrl = searchParams.get('status') || '';

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();
  const {
    from: dateFrom,
    to: dateTo,
    preset: datePreset,
    applyRange: applyDateRange,
    resetRange: resetDateRange,
    queryParams: dateQueryParams,
  } = useAdminDateFilter();
  const [status, setStatus] = useState(statusFromUrl);
  const [isOpen, setIsOpen] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [busyId, setBusyId] = useState('');

  const pageMeta = useMemo(() => {
    if (filterFromUrl === 'pending') {
      return { title: 'Gian hàng chờ duyệt', description: 'Các gian hàng đang chờ xác minh hoặc phê duyệt.' };
    }
    if (statusFromUrl === '0') {
      return { title: 'Gian hàng bị khóa', description: 'Danh sách gian hàng đang bị khóa trên hệ thống.' };
    }
    if (statusFromUrl === '1') {
      return { title: 'Gian hàng đã duyệt', description: 'Các gian hàng đang hoạt động bình thường.' };
    }
    return {
      title: 'Gian hàng',
      description: 'Danh sách gian hàng trên FastMark. Mỗi gian hàng gắn với một tài khoản chủ shop.',
    };
  }, [filterFromUrl, statusFromUrl]);

  useEffect(() => {
    setStatus(statusFromUrl);
    resetDateRange();
    setPage(1);
  }, [statusFromUrl, filterFromUrl, resetDateRange]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listShops(token, {
        search,
        status,
        isOpen,
        filter: filterFromUrl || undefined,
        page,
        limit,
        ...dateQueryParams,
      });
      setItems(payload.data?.items || []);
      setPagination(
        payload.data?.pagination || {
          page: 1,
          limit: DEFAULT_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        },
      );
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách gian hàng.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateQueryParams, dateTo, filterFromUrl, getIdToken, isOpen, limit, page, search, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function runAction(shopId, action) {
    setBusyId(shopId);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      if (action === 'block') await blockShop(token, shopId);
      if (action === 'unblock') await unblockShop(token, shopId);
      await loadItems();
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setBusyId('');
    }
  }

  function handleStatusChange(value) {
    setStatus(value);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    next.delete('filter');
    setSearchParams(next, { replace: true });
  }

  const activeCount = items.filter((shop) => shop.status === 1).length;
  const lockedCount = items.filter((shop) => shop.status === 0).length;
  const openCount = items.filter((shop) => shop.isOpen === 1).length;

  return (
    <AdminPageShell
      icon={FastMarkShopPinIcon}
      title={pageMeta.title}
      description={pageMeta.description}
      stats={[
        { label: 'Tổng gian hàng', value: loading ? '…' : pagination.total, icon: FastMarkShopPinIcon, tone: 'green' },
        { label: 'Đang hoạt động', value: loading ? '…' : activeCount, icon: UserCheck, tone: 'green' },
        { label: 'Đang mở cửa', value: loading ? '…' : openCount, icon: FastMarkShopPinIcon, tone: 'blue' },
        { label: 'Bị khóa', value: loading ? '…' : lockedCount, icon: UserX, tone: 'red' },
      ]}
    >
      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <p className="success-banner">{message}</p> : null}

      <DataTableShell
        title="Danh sách gian hàng"
        filterColumns={4}
        filters={
          <AdminFilterPanel
            layout="inline"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Tên shop, username, địa chỉ, SĐT..."
          >
            <label>
              Trạng thái hoạt động
              <select value={status} onChange={(event) => handleStatusChange(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all-status'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái mở/đóng
              <select
                value={isOpen}
                onChange={(event) => {
                  setIsOpen(event.target.value);
                  setPage(1);
                }}
              >
                {OPEN_OPTIONS.map((option) => (
                  <option key={option.value || 'all-open'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <AdminDateFilter
              from={dateFrom}
              to={dateTo}
              preset={datePreset}
              onApply={(range) => applyDateRange(range, () => setPage(1))}
            />
          </AdminFilterPanel>
        }
        pagination={
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            label="gian hàng"
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
        <table className="data-table admin-data-table shops-table">
          <thead>
            <tr>
              <TableSttHeader />
              <th>Gian hàng</th>
              <th>Chủ shop</th>
              <th>Địa chỉ</th>
              <th>Danh mục</th>
              <th>Đánh giá</th>
              <th className="col-open">Mở/đóng</th>
              <th>Gói</th>
              <th className="col-shop-status">Trạng thái</th>
              <th className="col-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="table-empty">Đang tải...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="table-empty">Không có gian hàng.</td>
              </tr>
            ) : (
              items.map((shop, index) => (
                <tr key={shop.id}>
                  <TableSttCell page={pagination.page} limit={limit} index={index} />
                  <td>
                    <div className="user-cell">
                      {shop.avatar ? (
                        <img src={shop.avatar} alt="" className="avatar-sm" />
                      ) : (
                        <div className="avatar-sm avatar-fallback">
                          {(shop.shopName || 'S').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <strong>{shop.shopName || ''}</strong>
                        <div className="muted">@{shop.shopUsername || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {shop.owner?.fullName || ''}
                    <div className="muted">{shop.owner?.email || ''}</div>
                  </td>
                  <td
                    className="table-address-clamp"
                    title={shop.addressHeThong || shop.systemAddress || shop.address || ''}
                  >
                    {shop.addressHeThong || shop.systemAddress || shop.address || ''}
                  </td>
                  <td>{shop.categoryName || ''}</td>
                  <td>
                    {Number(shop.averageRating) ? `${shop.averageRating} ★` : ''}
                    <div className="muted">{Number(shop.followersCount) || 0} theo dõi</div>
                  </td>
                  <td className="col-open">
                    <span className={shop.isOpen === 1 ? 'badge badge-success' : 'badge'}>
                      {shop.isOpenLabel}
                    </span>
                  </td>
                  <td>
                    {shop.subscriptionActive ? (
                      <span className="badge badge-success">
                        {shop.subscriptionPlan || 'Active'}
                        <div className="muted">{formatDate(shop.subscriptionExpiresAt)}</div>
                      </span>
                    ) : (
                      <span className="badge">Hết / chưa mua</span>
                    )}
                  </td>
                  <td className="col-shop-status">
                    <span className={shop.status === 1 ? 'badge badge-success' : 'badge badge-danger'}>
                      {shop.statusLabel}
                    </span>
                  </td>
                  <td className="col-actions">
                    <TableIconActions
                      actions={[
                        { icon: Eye, label: 'Chi tiết', to: `/shops/${shop.id}` },
                        shop.status === 1
                          ? {
                              icon: Lock,
                              label: 'Khóa gian hàng',
                              variant: 'warning',
                              disabled: busyId === shop.id,
                              onClick: () => runAction(shop.id, 'block'),
                            }
                          : {
                              icon: Unlock,
                              label: 'Mở khóa gian hàng',
                              variant: 'primary',
                              disabled: busyId === shop.id,
                              onClick: () => runAction(shop.id, 'unblock'),
                            },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>
    </AdminPageShell>
  );
}

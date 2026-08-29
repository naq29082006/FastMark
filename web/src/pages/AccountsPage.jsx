import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, Lock, ShoppingCart, Unlock, UserCheck, Users, UserX } from 'lucide-react';
import FastMarkShopPinIcon from '../components/icons/FastMarkShopPinIcon';

import {
  blockAccount,
  listAccounts,
  unblockAccount,
  getAccountStatistics,
} from '../api/accountApi';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminPageShell from '../components/admin/AdminPageShell';
import AdminPagination from '../components/admin/AdminPagination';
import DataTableShell from '../components/admin/DataTableShell';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { formatDateActivity } from '../utils/format';
import PreviewableImage from '../components/PreviewableImage';

const SHOP_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả người mua' },
  { value: 'has_shop', label: 'Có gian hàng' },
  { value: 'no_shop', label: 'Chưa có gian hàng' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Hoạt động' },
  { value: '0', label: 'Đã khóa' },
];

const VERIFICATION_OPTIONS = [
  { value: '', label: 'Tất cả xác minh' },
  { value: '0', label: 'Chờ duyệt' },
  { value: '1', label: 'Đã duyệt' },
  { value: '2', label: 'Đã từ chối' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'last_active', label: 'Hoạt động gần nhất' },
  { value: 'most_products', label: 'Nhiều sản phẩm nhất' },
];

function DateCell({ label, value }) {
  const formatted = formatDateActivity(value);
  if (!formatted) {
    return (
      <div className="activity-line">
        <span className="activity-label">{label}</span>
        <span className="activity-value" />
      </div>
    );
  }
  return (
    <div className="activity-line">
      <span className="activity-label">{label}</span>
      <span className="activity-value">
        <strong>{formatted.time}</strong>
        <em>{formatted.day}</em>
      </span>
    </div>
  );
}

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
}

/** Cột cửa hàng: trạng thái shop (khác với khóa tài khoản). */
function shopColumnState(item) {
  if (!item?.shop) return null;
  if (item.shop.status === 0) {
    const accountLocked = item.status === 0;
    return {
      label: accountLocked ? 'Shop khóa (kèm nick)' : 'Shop khóa',
      className: 'badge badge-danger',
    };
  }
  const verificationStatus = item.verification?.status;
  if (verificationStatus === 1) {
    return { label: 'Hoạt động', className: 'badge badge-success' };
  }
  if (verificationStatus === 2) {
    return { label: 'XM từ chối', className: 'badge badge-danger' };
  }
  return { label: 'Chờ duyệt', className: 'badge badge-warning' };
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index}>
          <td className="col-stt"><div className="skeleton skeleton-line short" /></td>
          <td className="col-account"><div className="skeleton skeleton-line" /></td>
          <td className="col-contact"><div className="skeleton skeleton-line" /></td>
          <td className="col-status"><div className="skeleton skeleton-line short" /></td>
          <td className="col-shop"><div className="skeleton skeleton-line short" /></td>
          <td className="col-activity"><div className="skeleton skeleton-line" /></td>
          <td className="col-actions"><div className="skeleton skeleton-line short" /></td>
        </tr>
      ))}
    </>
  );
}

function syncAccountQueryParams(searchParams, patch) {
  const next = new URLSearchParams(searchParams);
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  });
  return next;
}

export default function AccountsPage() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const viewFromUrl = searchParams.get('view') || 'buyers';
  const shopFilterFromUrl = searchParams.get('shop') || '';
  const statusFromUrl = searchParams.get('status') || '';
  const [statistics, setStatistics] = useState(null);
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
  const [busyId, setBusyId] = useState('');

  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();
  const {
    from: dateFrom,
    to: dateTo,
    preset: datePreset,
    applyRange: applyDateRange,
    resetRange: resetDateRange,
    queryParams: dateQueryParams,
  } = useAdminDateFilter();
  const [shopFilter, setShopFilter] = useState(shopFilterFromUrl);
  const [status, setStatus] = useState(statusFromUrl);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const loadStatistics = useCallback(async () => {
    try {
      const token = await getIdToken();
  
      const payload = await getAccountStatistics(token);
  
      setStatistics(payload.data?.statistics || null);
  
    } catch (error) {
      console.log("Load statistics error:", error);
    }
  }, [getIdToken]);
  useEffect(() => {
    setPage(1);
  }, [search]);

  const pageMeta = useMemo(() => {
    if (statusFromUrl === '0') {
      return {
        title: 'Tài khoản bị khóa',
        description: 'Danh sách tài khoản người dùng đang bị khóa truy cập.',
      };
    }
    if (viewFromUrl === 'all') {
      return {
        title: 'Tất cả người dùng',
        description: 'Toàn bộ tài khoản trên hệ thống FastMark, bao gồm người mua và người bán.',
      };
    }
    return {
      title: 'Người mua',
      description: 'Mọi tài khoản đều có thể mua hàng. Gian hàng được quản lý riêng ở mục Gian hàng.',
    };
  }, [statusFromUrl, viewFromUrl]);

  useEffect(() => {
    if (searchParams.get('role') === '2') {
      navigate('/shops', { replace: true });
      return;
    }
    setShopFilter(shopFilterFromUrl);
    setStatus(statusFromUrl);
    resetDateRange();
    setPage(1);
  }, [navigate, resetDateRange, searchParams, shopFilterFromUrl, statusFromUrl, viewFromUrl]);

  const hasShopQuery =
    shopFilter === 'has_shop' ? '1' : shopFilter === 'no_shop' ? '0' : '';

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getIdToken();
      const payload = await listAccounts(token, {
        search,
        hasShop: hasShopQuery,
        status,
        verificationStatus,
        sort,
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
      setError(loadError.message || 'Không tải được danh sách người dùng.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateQueryParams, dateTo, getIdToken, hasShopQuery, limit, page, search, sort, status, verificationStatus]);

  useEffect(() => {
    loadItems();
    loadStatistics();
  }, [loadItems, loadStatistics]);

  async function runAccountAction(accountId, action) {
    setBusyId(accountId);
    setMessage('');
    setError('');
  
    try {
      const token = await getIdToken();
  
      if (action === 'block') {
        await blockAccount(token, accountId);
        setMessage('Đã khóa tài khoản');
      } else {
        await unblockAccount(token, accountId);
        setMessage('Đã mở khóa tài khoản');
      }
  
      // reload danh sách
      await loadItems();
  
      // reload thống kê
      await loadStatistics();
  
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setBusyId('');
    }
  }

  function handleFilterChange(setter, value, urlPatch = {}) {
    setter(value);
    setPage(1);
    if (Object.keys(urlPatch).length) {
      setSearchParams(syncAccountQueryParams(searchParams, urlPatch), { replace: true });
    }
  }

  function handleShopFilterChange(value) {
    setShopFilter(value);
    setPage(1);
    setSearchParams(
      syncAccountQueryParams(searchParams, { shop: value || null, role: null }),
      { replace: true },
    );
  }

  function handleStatusChange(value) {
    setStatus(value);
    setPage(1);
    const patch = { status: value || null };
    if (value === '0') {
      patch.view = null;
    }
    setSearchParams(syncAccountQueryParams(searchParams, patch), { replace: true });
  }

  const filters = (
    <AdminFilterPanel
      layout="inline"
      searchValue={searchInput}
      onSearchChange={setSearchInput}
      searchPlaceholder="Tên đăng nhập, họ tên, email, SĐT, tên cửa hàng..."
    >
      <label>
        Gian hàng
        <select value={shopFilter} onChange={(event) => handleShopFilterChange(event.target.value)}>
          {SHOP_FILTER_OPTIONS.map((option) => (
            <option key={option.value || 'all-shop'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Trạng thái
        <select value={status} onChange={(event) => handleStatusChange(event.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all-status'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Xác minh người bán
        <select
          value={verificationStatus}
          onChange={(event) => handleFilterChange(setVerificationStatus, event.target.value)}
        >
          {VERIFICATION_OPTIONS.map((option) => (
            <option key={option.value || 'all-verification'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Sắp xếp
        <select value={sort} onChange={(event) => handleFilterChange(setSort, event.target.value)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
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
  );

  const lockedCount = statistics?.users?.blocked ?? 0;
  const activeCount = statistics?.users?.active ?? 0;
  const sellerCount = statistics?.users?.sellers ?? 0;
  const totalUsers = statistics?.users?.total ?? 0;
  const buyers = statistics?.users?.buyers ?? 0;

  return (
    <AdminPageShell
      icon={Users}
      title={pageMeta.title}
      description={pageMeta.description}
      stats={[
        { label: 'Tổng người dùng', value: loading ? '…' : totalUsers, icon: Users, tone: 'green' },
        { label: 'Người mua (trang)', value: loading ? '…' : buyers, icon: ShoppingCart, tone: 'blue' },
        { label: 'Có gian hàng', value: loading ? '…' : sellerCount, icon: FastMarkShopPinIcon, tone: 'amber' },
        { label: 'Đang hoạt động', value: loading ? '…' : activeCount, icon: UserCheck, tone: 'green' },
        { label: 'Bị khóa', value: loading ? '…' : lockedCount, icon: UserX, tone: 'red' },
      ]}
    >
      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <p className="success-banner">{message}</p> : null}

      <DataTableShell
        title="Danh sách người dùng"
        filterColumns={6}
        filters={filters}
        pagination={
          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            label="người dùng"
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
        <table className="data-table catalog-table accounts-table admin-data-table">
          <thead>
            <tr>
              <th className="col-stt">STT</th>
              <th className="col-account">Tài khoản</th>
              <th className="col-contact">Liên hệ</th>
              <th className="col-status">Trạng thái</th>
              <th className="col-shop">Cửa hàng</th>
              <th className="col-activity">Hoạt động</th>
              <th className="col-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows /> : null}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  Không tìm thấy người dùng phù hợp.
                </td>
              </tr>
            ) : null}
            {!loading
              ? items.map((item, index) => {
                  const shopState = shopColumnState(item);
                  const stt =
                    (Number(pagination.page) - 1) * limit +
                    index +
                    1;
                  return (
                    <tr key={item.id}>
                      <td className="col-stt stt-cell">{stt}</td>
                      <td className="col-account">
                        <div className="cell-with-avatar">
                          <PreviewableImage
                            src={item.avatar}
                            alt={item.fullName || item.userName || ''}
                            width={48}
                            height={48}
                            shape="rounded"
                            className="thumb-sm"
                            fallbackLetter={item.userName || 'U'}
                            fallbackClassName="thumb-sm thumb-fallback"
                          />
                          <div>
                            <div className="cell-title">{item.fullName || ''}</div>
                            <div className="cell-sub">@{item.userName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="col-contact">
                        <div className="cell-title soft">{item.email || ''}</div>
                        <div className="cell-sub">{item.phone || ''}</div>
                      </td>
                      <td className="col-status">
                        <span className={statusBadgeClass(item.status)}>{item.statusLabel}</span>
                      </td>
                      <td className="col-shop">
                        {shopState ? (
                          <span className={shopState.className}>{shopState.label}</span>
                        ) : (
                          <span className="cell-sub" />
                        )}
                      </td>
                      <td className="col-activity">
                        <DateCell label="Tạo" value={item.createdAt} />
                        <DateCell label="Gần nhất" value={item.lastActiveAt} />
                      </td>
                      <td className="col-actions">
                        <TableIconActions
                          actions={[
                            { icon: Eye, label: 'Chi tiết', to: `/accounts/${item.id}` },
                            item.status === 1
                              ? {
                                  icon: Lock,
                                  label: 'Khóa tài khoản',
                                  variant: 'warning',
                                  disabled: busyId === item.id,
                                  onClick: () => runAccountAction(item.id, 'block'),
                                }
                              : {
                                  icon: Unlock,
                                  label: 'Mở khóa tài khoản',
                                  variant: 'primary',
                                  disabled: busyId === item.id,
                                  onClick: () => runAccountAction(item.id, 'unblock'),
                                },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </DataTableShell>
    </AdminPageShell>
  );
}

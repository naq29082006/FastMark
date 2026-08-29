import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  Flag,
  MoreHorizontal,
  XCircle,
} from 'lucide-react';

import {
  approveSellerBanner,
  cancelSellerBanner,
  listBannerPlans,
  listSellerBanners,
  rejectSellerBanner,
} from '../api/sellerPlanApi';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminDetailTabs from '../components/admin/AdminDetailTabs';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminPageShell from '../components/admin/AdminPageShell';
import AdminPagination from '../components/admin/AdminPagination';
import DataTableShell from '../components/admin/DataTableShell';
import HomeBannerPreviewPanel from '../components/admin/HomeBannerPreviewPanel';
import PreviewableImage, { PreviewableImageGrid } from '../components/PreviewableImage';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { formatDate, formatDateTimeDetail, formatPrice } from '../utils/format';
import { keepIfSame, mergeListById } from '../utils/realtimeList';

const TABS = [
  { id: 'all', label: 'Tất cả', filter: '' },
  { id: 'pending', label: 'Chờ duyệt', filter: 'pending' },
  { id: 'active', label: 'Đang treo', filter: 'active' },
  { id: 'expired', label: 'Hết hạn', filter: 'expired' },
  { id: 'rejected', label: 'Đã từ chối', filter: 'rejected' },
];

function normalizeTab(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return 'all';
  const match = TABS.find((tab) => tab.id === value || tab.filter === value);
  return match?.id || 'active';
}

function resolveBannerPosition(row) {
  return Number(row?.targetType) === 1
    ? 'Trang chủ (Banner nhỏ 1)'
    : 'Trang chủ (Banner lớn)';
}

function lifecycleBadgeClass(lifecycle) {
  if (lifecycle === 'active') return 'badge badge-success';
  if (lifecycle === 'pending') return 'badge badge-warning';
  if (lifecycle === 'rejected') return 'badge badge-danger';
  if (lifecycle === 'expired') return 'badge badge-neutral';
  if (lifecycle === 'cancelled') return 'badge badge-warning';
  return 'badge badge-neutral';
}

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function BannerDetailDialog({ row, onClose }) {
  if (!row) return null;
  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide history-detail-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3>Chi tiết banner</h3>
            <p className="muted">ID: {row.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <dl className="detail-list detail-list-grid">
          <DetailField label="Seller">
            {row.seller?.fullName || row.seller?.userName || ''}
          </DetailField>
          <DetailField label="Email">{row.seller?.email || ''}</DetailField>
          <DetailField label="Shop">{row.shop?.shopName || row.shopId || ''}</DetailField>
          <DetailField label="Gói">{row.planName || ''}</DetailField>
          <DetailField label="Vị trí">{resolveBannerPosition(row)}</DetailField>
          <DetailField label="Đích đến">
            {row.targetTypeLabel || ''} {row.targetId ? `(${row.targetId})` : ''}
          </DetailField>
          <DetailField label="Giá">{formatPrice(row.amount)}</DetailField>
          <DetailField label="Ngày mua">{formatDate(row.ngayMua || row.createdAt)}</DetailField>
          <DetailField label="Bắt đầu">{formatDate(row.startDate) || 'Chưa duyệt'}</DetailField>
          <DetailField label="Kết thúc">{formatDate(row.endDate) || 'Chưa duyệt'}</DetailField>
          <DetailField label="Số click">{Number(row.clickCount) || 0}</DetailField>
          <DetailField label="Trạng thái">{row.lifecycleLabel || row.statusLabel || ''}</DetailField>
          <DetailField label="Lý do vi phạm">{row.lyDoVP || ''}</DetailField>
        </dl>
        {row.image ? (
          <PreviewableImageGrid
            className="image-grid account-verify-images"
            items={[row.image]}
            width={160}
            height={96}
            shape="rounded"
            getSrc={(url) => url}
            getAlt={() => 'Banner'}
          />
        ) : null}
        <div className="dialog-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
          {row.seller?.id || row.sellerId ? (
            <Link
              className="detail-btn"
              to={`/accounts/${row.seller?.id || row.sellerId}`}
              onClick={onClose}
            >
              Chi tiết seller
            </Link>
          ) : null}
          {row.shopId ? (
            <Link className="detail-btn" to={`/shops/${row.shopId}`} onClick={onClose}>
              Chi tiết shop
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}


export default function SellerBannersPage() {
  const { getIdToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const activeTab =
    filterParam === null || filterParam === undefined
      ? 'active'
      : normalizeTab(filterParam);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [summaryStats, setSummaryStats] = useState({
    pending: 0,
    active: 0,
    expired: 0,
  });
  const [bannerPlans, setBannerPlans] = useState([]);
  const [activePreviewBanners, setActivePreviewBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState(TABS.find((tab) => tab.id === activeTab)?.filter ?? 'active');
  const [planIdFilter, setPlanIdFilter] = useState('');
  const {
    from: dateFrom,
    to: dateTo,
    preset: datePreset,
    applyRange: applyDateRange,
    queryParams: dateQueryParams,
  } = useAdminDateFilter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [actionId, setActionId] = useState('');
  const [rejectId, setRejectId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selected, setSelected] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState('');

  const loadSummaryStats = useCallback(async (token) => {
    const [pendingRes, activeRes, expiredRes] = await Promise.all([
      listSellerBanners(token, { page: 1, limit: 1, filter: 'pending' }),
      listSellerBanners(token, { page: 1, limit: 1, filter: 'active' }),
      listSellerBanners(token, { page: 1, limit: 1, filter: 'expired' }),
    ]);
    setSummaryStats((current) =>
      keepIfSame(current, {
        pending: pendingRes.data?.pagination?.total || 0,
        active: activeRes.data?.pagination?.total || 0,
        expired: expiredRes.data?.pagination?.total || 0,
      })
    );
  }, []);

  const loadActivePreviewBanners = useCallback(async (token, { silent = false } = {}) => {
    if (!silent) {
      setPreviewLoading(true);
    }
    try {
      const payload = await listSellerBanners(token, {
        page: 1,
        limit: 100,
        filter: 'active',
      });
      setActivePreviewBanners((current) => mergeListById(current, payload.data?.items || []));
    } catch {
      if (!silent) {
        setActivePreviewBanners([]);
      }
    } finally {
      if (!silent) {
        setPreviewLoading(false);
      }
    }
  }, []);

  const loadItems = useCallback(async ({ silent = false } = {}) => {
    // silent = đồng bộ realtime: không bật loading, chỉ dòng nào đổi mới render lại.
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const token = await getIdToken();
      const payload = await listSellerBanners(token, {
        page,
        limit,
        filter,
        ...dateQueryParams,
      });
      const nextItems = payload.data?.items || [];
      setItems((current) => mergeListById(current, nextItems));
      setPagination((current) =>
        keepIfSame(
          current,
          payload.data?.pagination || {
            page,
            limit,
            total: nextItems.length,
            totalPages: 1,
          }
        )
      );
      await Promise.all([
        loadSummaryStats(token),
        loadActivePreviewBanners(token, { silent }),
      ]);
      setPreviewRow((current) => {
        if (current && nextItems.some((row) => row.id === current.id)) {
          return current;
        }
        return nextItems.find((row) => row.image) || nextItems[0] || null;
      });
    } catch (loadError) {
      if (silent) {
        return;
      }
      setError(loadError.message || 'Không tải được danh sách banner.');
      setItems([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [
    dateQueryParams,
    filter,
    getIdToken,
    limit,
    loadActivePreviewBanners,
    loadSummaryStats,
    page,
  ]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useAdminRealtimeRefresh('banner', () => loadItems({ silent: true }), {
    coalesceMs: REALTIME_COALESCE_MS,
  });

  useEffect(() => {
    async function loadPlans() {
      try {
        const token = await getIdToken();
        const payload = await listBannerPlans(token);
        setBannerPlans(payload.data?.plans || []);
      } catch {
        setBannerPlans([]);
      }
    }
    loadPlans();
  }, [getIdToken]);

  useEffect(() => {
    const tab = TABS.find((item) => item.id === activeTab);
    const nextFilter = tab?.filter ?? 'active';
    setFilter(nextFilter);
    setPage(1);
  }, [activeTab]);

  const visibleItems = useMemo(() => {
    if (!planIdFilter) return items;
    return items.filter((row) => String(row.planId) === String(planIdFilter));
  }, [items, planIdFilter]);

  function handleStatusFilterChange(nextFilter) {
    setFilter(nextFilter);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (!nextFilter) {
      nextParams.set('filter', 'all');
    } else {
      nextParams.set('filter', nextFilter);
    }
    setSearchParams(nextParams, { replace: true });
  }

  const statCards = [
    {
      label: 'Trong bộ lọc',
      value: loading ? '…' : pagination.total,
      icon: Flag,
      tone: 'green',
    },
    {
      label: 'Chờ duyệt',
      value: loading ? '…' : summaryStats.pending,
      icon: Clock,
      tone: 'amber',
      onClick: () => setTab('pending'),
    },
    {
      label: 'Đang treo',
      value: loading ? '…' : summaryStats.active,
      icon: CheckCircle,
      tone: 'blue',
      onClick: () => setTab('active'),
    },
    {
      label: 'Đã hết hạn',
      value: loading ? '…' : summaryStats.expired,
      icon: XCircle,
      tone: 'red',
      onClick: () => setTab('expired'),
    },
  ];

  function setTab(tabId) {
    const next = normalizeTab(tabId);
    const nextParams = new URLSearchParams(searchParams);
    const tab = TABS.find((item) => item.id === next);
    if (!tab || next === 'active') {
      nextParams.set('filter', 'active');
    } else if (tab.filter) {
      nextParams.set('filter', tab.filter);
    } else {
      nextParams.set('filter', 'all');
    }
    setSearchParams(nextParams, { replace: true });
    setPage(1);
  }

  async function handleApprove(banner) {
    const confirmed = window.confirm(
      `Duyệt treo banner "${banner.planName || 'banner'}"?\nHiệu lực sẽ tính từ lúc duyệt.`
    );
    if (!confirmed) return;
    setActionId(banner.id);
    setError('');
    setSuccessMessage('');
    setMenuOpenId('');
    try {
      const token = await getIdToken();
      await approveSellerBanner(token, banner.id);
      setSuccessMessage('Đã duyệt treo banner.');
      await loadItems();
    } catch (approveError) {
      setError(approveError.message || 'Không duyệt được banner.');
    } finally {
      setActionId('');
    }
  }

  async function handleReject(bannerId) {
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Vui lòng nhập lý do từ chối.');
      return;
    }
    setActionId(bannerId);
    setError('');
    setSuccessMessage('');
    setMenuOpenId('');
    try {
      const token = await getIdToken();
      await rejectSellerBanner(token, bannerId, { reason });
      setSuccessMessage('Đã từ chối. Seller có thể sửa creative và gửi lại.');
      setRejectId('');
      setRejectReason('');
      await loadItems();
    } catch (rejectError) {
      setError(rejectError.message || 'Không từ chối được banner.');
    } finally {
      setActionId('');
    }
  }

  async function handleTakeDown(banner) {
    const isActive = banner.lifecycle === 'active';
    const confirmed = window.confirm(
      isActive
        ? `Gỡ treo banner "${banner.planName || 'banner'}" khỏi Home?\nBanner sẽ ngừng hiển thị ngay.`
        : `Hủy gói banner "${banner.planName || 'banner'}"?`
    );
    if (!confirmed) return;
    setActionId(banner.id);
    setError('');
    setSuccessMessage('');
    setMenuOpenId('');
    try {
      const token = await getIdToken();
      await cancelSellerBanner(token, banner.id);
      setSuccessMessage(isActive ? 'Đã gỡ treo banner.' : 'Đã hủy banner.');
      await loadItems();
    } catch (cancelError) {
      setError(cancelError.message || 'Không cập nhật được banner.');
    } finally {
      setActionId('');
    }
  }

  return (
    <div className="admin-page seller-banners-home-page">
      <AdminPageShell stats={statCards}>
        {error ? <p className="error-banner">{error}</p> : null}
        {successMessage ? <p className="success-banner">{successMessage}</p> : null}

        <div className="banner-home-layout">
          <div className="banner-home-main">
            <DataTableShell
              filterColumns={3}
              filters={
                <AdminFilterPanel layout="inline" showSearch={false}>
                  <label>
                    Trạng thái
                    <select
                      value={filter}
                      onChange={(event) => handleStatusFilterChange(event.target.value)}
                    >
                      <option value="">Tất cả</option>
                      <option value="pending">Chờ duyệt</option>
                      <option value="active">Đang treo</option>
                      <option value="expired">Hết hạn</option>
                      <option value="rejected">Đã từ chối</option>
                      <option value="cancelled">Đã hủy / gỡ</option>
                      <option value="purchased">Chưa yêu cầu treo</option>
                    </select>
                  </label>
                  <label>
                    Gói banner
                    <select
                      value={planIdFilter}
                      onChange={(event) => {
                        setPlanIdFilter(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">Tất cả gói</option>
                      {bannerPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
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
                  label="banner"
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
              <div className="banner-home-table-tabs">
                <AdminDetailTabs
                  tabs={TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
                  activeTab={activeTab}
                  onChange={setTab}
                  variant="underline"
                />
              </div>

              <table className="data-table admin-data-table banner-home-table">
                <thead>
                  <tr>
                    <th>Banner</th>
                    <th>Seller / Shop</th>
                    <th>Gói banner</th>
                    <th>Thời gian</th>
                    <th>Giá</th>
                    <th>Hiệu lực</th>
                    <th>Số click</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="table-empty">
                        Đang tải...
                      </td>
                    </tr>
                  ) : visibleItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="table-empty">
                        Không có banner trong bộ lọc này.
                      </td>
                    </tr>
                  ) : (
                    visibleItems.map((row) => (
                      <tr
                        key={row.id}
                        className={
                          previewRow?.id === row.id ? 'banner-home-row is-selected' : 'banner-home-row'
                        }
                      >
                        <td>
                          {row.image ? (
                            <PreviewableImage
                              src={row.image}
                              alt=""
                              width={72}
                              height={40}
                              shape="rounded"
                              className="banner-home-table-thumb"
                              onClick={(event) => event.stopPropagation()}
                            />
                          ) : (
                            <span className="muted">Chưa có ảnh</span>
                          )}
                        </td>
                        <td>
                          <strong>{row.shop?.shopName || row.seller?.fullName || '—'}</strong>
                          <div className="muted">
                            @
                            {row.shop?.shopUsername ||
                              row.seller?.userName ||
                              row.seller?.email ||
                              '—'}
                          </div>
                        </td>
                        <td>{row.planName || '—'}</td>
                        <td>{formatDateTimeDetail(row.ngayMua || row.createdAt) || '—'}</td>
                        <td>{formatPrice(row.amount)}</td>
                        <td>
                          {row.startDate || row.endDate ? (
                            <>
                              <div>{formatDate(row.startDate)}</div>
                              <div className="muted">→ {formatDate(row.endDate)}</div>
                            </>
                          ) : (
                            <span className="muted">Chưa duyệt</span>
                          )}
                        </td>
                        <td>
                          <strong>{Number(row.clickCount) || 0}</strong>
                        </td>
                        <td>
                          <span className={lifecycleBadgeClass(row.lifecycle)}>
                            {row.lifecycleLabel || row.statusLabel}
                          </span>
                        </td>
                        <td>
                          <div className="banner-home-row-actions">
                            <button
                              type="button"
                              className="detail-btn"
                              onClick={() => setPreviewRow(row)}
                            >
                              Xem trước
                            </button>
                            <div className="banner-home-menu-wrap">
                              <button
                                type="button"
                                className="ghost-btn banner-home-menu-btn"
                                aria-label="Thêm thao tác"
                                onClick={() =>
                                  setMenuOpenId((prev) => (prev === row.id ? '' : row.id))
                                }
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              {menuOpenId === row.id ? (
                                <div className="banner-home-menu">
                                  <button type="button" onClick={() => setSelected(row)}>
                                    Chi tiết
                                  </button>
                                  {row.lifecycle === 'pending' ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={actionId === row.id}
                                        onClick={() => handleApprove(row)}
                                      >
                                        Duyệt treo
                                      </button>
                                      <button
                                        type="button"
                                        disabled={actionId === row.id}
                                        onClick={() => {
                                          setRejectId(row.id);
                                          setMenuOpenId('');
                                        }}
                                      >
                                        Từ chối
                                      </button>
                                    </>
                                  ) : null}
                                  {row.lifecycle === 'active' ? (
                                    <button
                                      type="button"
                                      disabled={actionId === row.id}
                                      onClick={() => handleTakeDown(row)}
                                    >
                                      Gỡ treo
                                    </button>
                                  ) : null}
                                  {row.lifecycle === 'purchased' ? (
                                    <button
                                      type="button"
                                      disabled={actionId === row.id}
                                      onClick={() => handleTakeDown(row)}
                                    >
                                      Hủy gói
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {rejectId === row.id ? (
                            <div className="reject-inline">
                              <textarea
                                rows={2}
                                placeholder="Lý do từ chối (seller sửa rồi gửi lại)"
                                value={rejectReason}
                                onChange={(event) => setRejectReason(event.target.value)}
                              />
                              <div className="action-row">
                                <button
                                  type="button"
                                  className="danger-btn"
                                  disabled={actionId === row.id}
                                  onClick={() => handleReject(row.id)}
                                >
                                  Xác nhận từ chối
                                </button>
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  onClick={() => {
                                    setRejectId('');
                                    setRejectReason('');
                                  }}
                                >
                                  Hủy
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </div>

          <HomeBannerPreviewPanel
            banner={previewRow}
            activeBanners={activePreviewBanners}
            loading={previewLoading}
          />
        </div>
      </AdminPageShell>

      {selected ? <BannerDetailDialog row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

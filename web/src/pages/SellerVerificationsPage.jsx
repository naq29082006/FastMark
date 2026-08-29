import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Clock,
  UserCheck,
  X,
} from 'lucide-react';

import FastMarkShopPinIcon from '../components/icons/FastMarkShopPinIcon';

import { listCategories } from '../api/categoryApi';
import {
  approveVerification,
  listAdminVerifications,
  rejectVerification,
} from '../api/sellerApi';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminPageShell from '../components/admin/AdminPageShell';
import AdminPagination from '../components/admin/AdminPagination';
import AdminTimeline from '../components/admin/AdminTimeline';
import PreviewableImage, { VerifyDocCard } from '../components/PreviewableImage';
import { EmptyState } from '../components/ui/Feedback';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { formatDateActivity } from '../utils/format';
import { keepIfSame, mergeListById } from '../utils/realtimeList';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '0', label: 'Chờ duyệt' },
  { value: '1', label: 'Đã duyệt' },
  { value: '2', label: 'Từ chối' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

function verificationStatusBadge(status) {
  if (status === 1) return { label: 'Đã duyệt', className: 'badge badge-success' };
  if (status === 2) return { label: 'Từ chối', className: 'badge badge-danger' };
  return { label: 'Chờ duyệt', className: 'badge badge-warning' };
}

function ApplicantCell({ item }) {
  const user = item.user;

  return (
    <div className="seller-verify-applicant">
      <PreviewableImage
        src={user?.avatar}
        alt={user?.fullName || item.shopName || 'Ứng viên'}
        width={40}
        height={40}
        shape="circle"
        fallbackLetter={user?.fullName || user?.userName || item.shopName || 'U'}
        className="seller-verify-applicant-avatar"
      />
      <div className="seller-verify-applicant-meta">
        <strong>{user?.fullName || item.shopName || 'Ứng viên'}</strong>
        <span>{user?.phone || user?.email || ''}</span>
      </div>
    </div>
  );
}

function SubmittedCell({ value }) {
  const formatted = formatDateActivity(value);
  if (!formatted) {
    return <span className="muted">—</span>;
  }
  return (
    <div className="activity-line compact">
      <span className="activity-value">
        <strong>{formatted.time}</strong>
        <em>{formatted.day}</em>
      </span>
    </div>
  );
}

function buildReviewTimeline(item) {
  if (!item) return [];

  const events = [
    {
      label: 'Gửi hồ sơ đăng ký',
      at: item.submittedAt || item.createdAt,
      detail: item.shopName ? `Gian hàng: ${item.shopName}` : '',
      tone: 'slate',
    },
  ];

  if (item.status === 1) {
    events.push({
      label: 'Đã duyệt',
      at: item.approvedAt || item.updatedAt,
      detail: item.approvedByAdmin?.fullName
        ? `Người duyệt: ${item.approvedByAdmin.fullName}`
        : '',
      tone: 'success',
    });
  }

  if (item.status === 2) {
    events.push({
      label: 'Đã từ chối',
      at: item.rejectedAt || item.updatedAt,
      detail: item.lyDoTuChoi || '',
      tone: 'danger',
    });
  }

  return events;
}

function VerificationDetailPanel({
  item,
  actionId,
  rejectReason,
  onRejectReasonChange,
  onApprove,
  onReject,
}) {
  if (!item) {
    return (
      <aside className="seller-verify-detail-panel empty">
        <EmptyState title="Chọn hồ sơ" description="Chọn một ứng viên ở bảng bên trái để xem chi tiết." />
      </aside>
    );
  }

  const user = item.user;
  const statusBadge = verificationStatusBadge(item.status);
  const isPending = item.status === 0;
  const address =
    item.addressHeThong || item.systemAddress || item.DiaChiHeThong || item.address || '';

  return (
    <aside className="seller-verify-detail-panel">
      <header className="seller-verify-detail-head">
        <div>
          <h2>Chi tiết hồ sơ</h2>
          <span className={statusBadge.className}>{statusBadge.label}</span>
        </div>
        <div className="seller-verify-detail-actions">
          {isPending ? (
            <>
              <button
                type="button"
                className="approve-btn btn-with-icon"
                disabled={actionId === item.id}
                onClick={() => onApprove(item.id)}
              >
                <Check size={16} aria-hidden="true" />
                {actionId === item.id ? 'Đang xử lý...' : 'Duyệt'}
              </button>
              <button
                type="button"
                className="danger-btn btn-with-icon"
                disabled={actionId === item.id}
                onClick={() => onReject(item.id)}
              >
                <X size={16} aria-hidden="true" />
                Từ chối
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="seller-verify-detail-body">
        <section className="seller-verify-detail-section">
          <div className="seller-verify-detail-section-head">
            <h3>Thông tin cá nhân</h3>
            <PreviewableImage
              src={user?.avatar}
              alt={user?.fullName || 'Người đăng ký'}
              width={48}
              height={48}
              shape="circle"
              fallbackLetter={user?.fullName || user?.userName || 'U'}
              className="seller-verify-detail-side-avatar"
            />
          </div>
          <dl className="seller-verify-field-grid">
            <div><dt>Họ tên</dt><dd>{user?.fullName || '—'}</dd></div>
            <div><dt>Email</dt><dd>{user?.email || '—'}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{user?.phone || '—'}</dd></div>
            <div><dt>Username</dt><dd>{user?.userName ? `@${user.userName}` : '—'}</dd></div>
          </dl>
        </section>

        <section className="seller-verify-detail-section">
          <div className="seller-verify-detail-section-head">
            <h3>Thông tin gian hàng đăng ký</h3>
            <span className="seller-verify-detail-side-logo">
              <FastMarkShopPinIcon size={24} aria-hidden="true" />
            </span>
          </div>
          <dl className="seller-verify-field-grid">
            <div><dt>Tên gian hàng</dt><dd>{item.shopName || '—'}</dd></div>
            <div><dt>Username</dt><dd>{item.shopUsername ? `@${item.shopUsername}` : '—'}</dd></div>
            <div><dt>Danh mục</dt><dd>{item.categoryName || '—'}</dd></div>
            <div><dt>Địa chỉ kinh doanh</dt><dd>{address || '—'}</dd></div>
            {Number.isFinite(item.latlong?.lat) && Number.isFinite(item.latlong?.long) ? (
              <div className="span-2">
                <dt>Tọa độ</dt>
                <dd>
                  <a
                    className="link-btn"
                    href={`https://www.google.com/maps?q=${item.latlong.lat},${item.latlong.long}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.latlong.lat}, {item.latlong.long} — Xem bản đồ
                  </a>
                </dd>
              </div>
            ) : Number.isFinite(item.latitude) && Number.isFinite(item.longitude) ? (
              <div className="span-2">
                <dt>Tọa độ</dt>
                <dd>
                  <a
                    className="link-btn"
                    href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.latitude}, {item.longitude} — Xem bản đồ
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="seller-verify-detail-section">
          <h3>Giấy tờ xác minh</h3>
          <div className="seller-verify-doc-grid">
            <VerifyDocCard label="CCCD mặt trước" url={item.anhCccdTruoc} />
            <VerifyDocCard label="CCCD mặt sau" url={item.anhCccdSau} />
            <VerifyDocCard label="Ảnh selfie" url={item.selfieImage} />
            <VerifyDocCard label="Giấy tờ kinh doanh" url={item.anhKD} />
          </div>
        </section>

        {isPending ? (
          <section className="seller-verify-detail-section">
            <h3>Lý do từ chối</h3>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(event) => onRejectReasonChange(event.target.value)}
              placeholder="Nhập lý do nếu từ chối hồ sơ..."
            />
          </section>
        ) : null}

        <AdminTimeline events={buildReviewTimeline(item)} title="Lịch sử xét duyệt" />
      </div>
    </aside>
  );
}

export default function SellerVerificationsPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionId, setActionId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();
  const {
    from: dateFrom,
    to: dateTo,
    preset: datePreset,
    applyRange: applyDateRange,
    queryParams: dateQueryParams,
  } = useAdminDateFilter();
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [categories, setCategories] = useState([]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const loadItems = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
      setSuccessMessage('');
    }

    try {
      const token = await getIdToken();
      const payload = await listAdminVerifications(token, {
        page,
        limit,
        search,
        status,
        categoryId,
        sort,
        ...dateQueryParams,
      });
      const nextItems = payload.data?.verifications || [];
      setItems((current) => mergeListById(current, nextItems));
      setStats((current) =>
        keepIfSame(
          current,
          payload.data?.stats || { total: 0, pending: 0, approved: 0, rejected: 0 }
        )
      );
      setPagination((current) =>
        keepIfSame(current, payload.data?.pagination || { page, limit, total: 0, totalPages: 1 })
      );
      setSelectedId((current) => {
        if (current && nextItems.some((item) => item.id === current)) {
          return current;
        }
        return nextItems[0]?.id || '';
      });
    } catch (loadError) {
      if (silent) {
        return;
      }
      setError(loadError.message || 'Không tải được danh sách hồ sơ.');
      setItems([]);
      setSelectedId('');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [categoryId, dateFrom, dateQueryParams, dateTo, getIdToken, limit, page, search, sort, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useAdminRealtimeRefresh('verification', () => loadItems({ silent: true }), {
    coalesceMs: REALTIME_COALESCE_MS,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const token = await getIdToken();
        const payload = await listCategories(token, 'shops');
        if (!cancelled) {
          setCategories(payload.data?.categories || []);
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setRejectReason('');
  }, [selectedId]);

  function handleStatClick(nextStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  async function handleApprove(verificationId) {
    setActionId(verificationId);
    setError('');
    setSuccessMessage('');

    try {
      const token = await getIdToken();
      await approveVerification(token, verificationId);
      setSuccessMessage('Đã duyệt hồ sơ người bán.');
      await loadItems();
    } catch (approveError) {
      setError(approveError.message || 'Không duyệt được hồ sơ.');
    } finally {
      setActionId('');
    }
  }

  async function handleReject(verificationId) {
    const lyDoTuChoi = rejectReason.trim();
    if (!lyDoTuChoi) {
      setError('Vui lòng nhập lý do từ chối.');
      return;
    }

    setActionId(verificationId);
    setError('');
    setSuccessMessage('');

    try {
      const token = await getIdToken();
      await rejectVerification(token, verificationId, lyDoTuChoi);
      setRejectReason('');
      setSuccessMessage('Đã từ chối hồ sơ người bán.');
      await loadItems();
    } catch (rejectError) {
      setError(rejectError.message || 'Không từ chối được hồ sơ.');
    } finally {
      setActionId('');
    }
  }

  const statCards = [
    {
      label: 'Tổng hồ sơ',
      value: loading ? '…' : stats.total,
      icon: UserCheck,
      tone: 'slate',
      onClick: () => handleStatClick(''),
    },
    {
      label: 'Chờ duyệt',
      value: loading ? '…' : stats.pending,
      icon: Clock,
      tone: 'amber',
      onClick: () => handleStatClick('0'),
    },
    {
      label: 'Đã duyệt',
      value: loading ? '…' : stats.approved,
      icon: BadgeCheck,
      tone: 'green',
      onClick: () => handleStatClick('1'),
    },
    {
      label: 'Từ chối',
      value: loading ? '…' : stats.rejected,
      icon: X,
      tone: 'red',
      onClick: () => handleStatClick('2'),
    },
  ];

  return (
    <AdminPageShell
      stats={statCards.map((card) => ({
        label: card.label,
        value: card.value,
        icon: card.icon,
        tone: card.tone,
        onClick: card.onClick,
        active: card.onClick
          ? (card.label === 'Tổng hồ sơ' && status === '') ||
            (card.label === 'Chờ duyệt' && status === '0') ||
            (card.label === 'Đã duyệt' && status === '1') ||
            (card.label === 'Từ chối' && status === '2')
          : false,
      }))}
      filters={
        <AdminFilterPanel
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Tìm theo tên, SĐT, email, gian hàng..."
        >
          <label>
            Danh mục
            <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}>
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id || category._id} value={category.id || category._id}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all-status'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sắp xếp
            <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
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
      }
    >
      <div className="seller-verify-page-head">
        <div>
          <h1 className="admin-page-title">
            <BadgeCheck size={24} aria-hidden="true" />
            Duyệt gian hàng
          </h1>
          <p className="admin-page-desc">
            Xem xét hồ sơ đăng ký gian hàng, duyệt hoặc từ chối yêu cầu mở shop.
          </p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <div className="seller-verify-split">
        <section className="seller-verify-list-panel">
          <div className="seller-verify-list-head">
            <h2>Danh sách hồ sơ</h2>
            <span className="muted">{pagination.total || 0} hồ sơ</span>
          </div>

          <div className="table-card seller-verify-table-wrap">
            {loading && items.length === 0 ? (
              <div className="seller-verify-table-skeleton">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="skeleton skeleton-line" />
                ))}
              </div>
            ) : null}

            {!loading && items.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="Không có hồ sơ"
                description="Thử đổi bộ lọc hoặc tìm kiếm khác."
              />
            ) : null}

            {items.length ? (
              <div className="seller-verify-table-scroll">
                <table className="data-table seller-verify-table">
                  <thead>
                    <tr>
                      <th className="col-check" aria-label="Chọn" />
                      <th>Ứng viên</th>
                      <th>Gian hàng đăng ký</th>
                      <th>Ngày đăng ký</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const badge = verificationStatusBadge(item.status);
                      const isSelected = item.id === selectedId;
                      return (
                        <tr
                          key={item.id}
                          className={isSelected ? 'selected' : undefined}
                          onClick={() => setSelectedId(item.id)}
                        >
                          <td className="col-check">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              aria-label={`Chọn ${item.user?.fullName || item.shopName}`}
                            />
                          </td>
                          <td>
                            <ApplicantCell item={item} />
                          </td>
                          <td>
                            <div className="cell-title">{item.shopName || '—'}</div>
                            <div className="cell-sub">{item.categoryName || 'Chưa chọn danh mục'}</div>
                          </td>
                          <td>
                            <SubmittedCell value={item.submittedAt || item.createdAt} />
                          </td>
                          <td>
                            <span className={badge.className}>{badge.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {items.length ? (
              <div className="admin-pagination seller-verify-pagination">
                <AdminPagination
                  page={pagination.page || page}
                  totalPages={pagination.totalPages || 1}
                  total={pagination.total || 0}
                  label="hồ sơ"
                  limit={limit}
                  onLimitChange={(next) => {
                    setLimit(next);
                    setPage(1);
                  }}
                  loading={loading}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </div>
        </section>

        <VerificationDetailPanel
          item={selectedItem}
          actionId={actionId}
          rejectReason={rejectReason}
          onRejectReasonChange={setRejectReason}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
    </AdminPageShell>
  );
}

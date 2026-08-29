import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, X } from 'lucide-react';

import {
  approveAdminWithdraw,
  listAdminWithdraws,
  rejectAdminWithdraw,
} from '../api/bankApi';
import AdminDateFilter from '../components/admin/AdminDateFilter';
import AdminFilterPanel from '../components/admin/AdminFilterPanel';
import AdminPagination from '../components/admin/AdminPagination';
import { TableSttCell, TableSttHeader } from '../components/admin/TableStt';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { formatDate, formatPrice } from '../utils/format';
import { mergeListById } from '../utils/realtimeList';

const TABS = [
  { id: 'pending', label: 'Chờ duyệt', status: '0' },
  { id: 'history', label: 'Lịch sử', status: '' },
];

const HISTORY_STATUS_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: '1', label: 'Đã duyệt' },
  { value: '2', label: 'Từ chối' },
];

function DetailField({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? ''}</dd>
    </div>
  );
}

function WithdrawDetailDialog({ item, onClose }) {
  if (!item) return null;
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
            <h3>Chi tiết rút tiền</h3>
            <p className="muted">ID: {item.id || ''}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <dl className="detail-list detail-list-grid">
          <DetailField label="Người rút">{item.userName || item.userId || ''}</DetailField>
          <DetailField label="SĐT">{item.userPhone || ''}</DetailField>
          <DetailField label="Email">{item.userEmail || ''}</DetailField>
          <DetailField label="Ngân hàng">
            {item.bankName}
            {item.bankCode ? ` (${item.bankCode})` : ''}
          </DetailField>
          <DetailField label="Số tài khoản">{item.accountNumber || ''}</DetailField>
          <DetailField label="Chủ tài khoản">{item.accountName || ''}</DetailField>
          <DetailField label="Số tiền">
            <strong>{formatPrice(item.amount)}</strong>
          </DetailField>
          <DetailField label="Trạng thái">{item.statusLabel || ''}</DetailField>
          <DetailField label="Ghi chú admin">{item.adminNote || ''}</DetailField>
          <DetailField label="Tạo lúc">{formatDate(item.createdAt)}</DetailField>
          <DetailField label="Xử lý lúc">{formatDate(item.tgXuLy)}</DetailField>
        </dl>
        {item.userId ? (
          <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
            <Link className="detail-btn" to={`/accounts/${item.userId}`} onClick={onClose}>
              Chi tiết tài khoản
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function WithdrawalsPage() {
  const { getIdToken } = useAuth();
  const [tab, setTab] = useState('pending');
  const [historyStatus, setHistoryStatus] = useState('');
  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionId, setActionId] = useState('');
  const [selected, setSelected] = useState(null);

  const statusParam = useMemo(() => {
    if (tab === 'pending') return '0';
    if (historyStatus === '') return '1,2';
    return historyStatus;
  }, [tab, historyStatus]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadItems = useCallback(
    async ({ silent = false } = {}) => {
      // silent = đồng bộ realtime: không bật loading, chỉ dòng nào đổi mới render lại.
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const token = await getIdToken();
        const payload = await listAdminWithdraws(token, {
          status: statusParam === '' ? undefined : statusParam,
          q: search || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit,
        });
        setItems((current) => mergeListById(current, payload.data?.items || []));
        setTotal(Number(payload.data?.total) || 0);
      } catch (loadError) {
        if (silent) {
          return;
        }
        setError(loadError.message || 'Không tải được yêu cầu rút tiền.');
        setItems([]);
        setTotal(0);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [from, getIdToken, limit, page, search, statusParam, to]
  );

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useAdminRealtimeRefresh('withdraw', () => loadItems({ silent: true }), {
    coalesceMs: REALTIME_COALESCE_MS,
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  function switchTab(nextTab) {
    setTab(nextTab);
    setPage(1);
    setSuccessMessage('');
    setFrom('');
    setTo('');
    setDatePreset('all');
    if (nextTab === 'history') {
      setHistoryStatus('');
    }
  }

  async function handleApprove(item) {
    const note = window.prompt('Ghi chú duyệt (tuỳ chọn):', '') ?? '';
    setActionId(item.id);
    setError('');
    try {
      const token = await getIdToken();
      await approveAdminWithdraw(token, item.id, { adminNote: note });
      setSuccessMessage(`Đã duyệt rút ${formatPrice(item.amount)}.`);
      await loadItems();
    } catch (approveError) {
      setError(approveError.message || 'Không duyệt được.');
    } finally {
      setActionId('');
    }
  }

  async function handleReject(item) {
    const note = window.prompt('Lý do từ chối (sẽ hiện trên app):', 'Thông tin tài khoản không hợp lệ');
    if (note === null) return;
    setActionId(item.id);
    setError('');
    try {
      const token = await getIdToken();
      await rejectAdminWithdraw(token, item.id, { adminNote: note });
      setSuccessMessage(`Đã từ chối và hoàn ${formatPrice(item.amount)} về ví.`);
      await loadItems();
    } catch (rejectError) {
      setError(rejectError.message || 'Không từ chối được.');
    } finally {
      setActionId('');
    }
  }

  return (
    <div className="page withdrawals-page">
      {error ? <p className="error-banner">{error}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <section className="table-card">
        <div
          className={`withdrawals-table-head withdrawals-table-head--with-filters${
            tab === 'history' ? ' is-history' : ''
          }`}
        >
          <strong>
            {tab === 'pending' ? 'Yêu cầu chờ duyệt' : 'Lịch sử rút tiền'} · {total} phiếu
          </strong>
          <AdminFilterPanel
            layout="inline"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Tên, SĐT, email, STK, ngân hàng..."
          >
            <label>
              Loại xem
              <select value={tab} onChange={(event) => switchTab(event.target.value)}>
                {TABS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {tab === 'history' ? (
              <label>
                Trạng thái
                <select
                  value={historyStatus}
                  onChange={(event) => {
                    setHistoryStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  {HISTORY_STATUS_FILTERS.map((item) => (
                    <option key={item.value || 'all'} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <AdminDateFilter
              from={from}
              to={to}
              preset={datePreset}
              onApply={(range) => {
                setFrom(range.from || '');
                setTo(range.to || '');
                setDatePreset(range.preset || (!range.from && !range.to ? 'all' : 'custom'));
                setPage(1);
              }}
            />
          </AdminFilterPanel>
        </div>
        <div className="table-scroll">
          <table className="data-table admin-data-table withdrawals-table">
          <thead>
            <tr>
              <TableSttHeader />
              <th>Thời gian</th>
              <th>User</th>
              <th>Ngân hàng</th>
              <th>STK / Chủ TK</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th>Xử lý lúc</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>Đang tải...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  {tab === 'pending'
                    ? 'Không có yêu cầu chờ duyệt.'
                    : 'Không có lịch sử rút tiền theo bộ lọc.'}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <TableSttCell page={page} limit={limit} index={index} />
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <strong>{item.userName || item.userId}</strong>
                    <div className="muted">{item.userPhone || item.userEmail || ''}</div>
                  </td>
                  <td>
                    {item.bankName}
                    {item.bankCode ? ` (${item.bankCode})` : ''}
                  </td>
                  <td>
                    <div>{item.accountNumber}</div>
                    <div className="muted">{item.accountName}</div>
                  </td>
                  <td>
                    <strong>{formatPrice(item.amount)}</strong>
                  </td>
                  <td>
                    <span
                      className={
                        item.status === 1
                          ? 'badge badge-success'
                          : item.status === 2
                            ? 'badge badge-danger'
                            : 'badge badge-warning'
                      }
                    >
                      {item.statusLabel}
                    </span>
                    {item.adminNote ? <div className="muted">{item.adminNote}</div> : null}
                  </td>
                  <td>{formatDate(item.tgXuLy)}</td>
                  <td className="col-actions">
                    <TableIconActions
                      actions={[
                        {
                          icon: Eye,
                          label: 'Chi tiết rút tiền',
                          onClick: () => setSelected(item),
                        },
                        ...(item.status === 0
                          ? [
                              {
                                icon: Check,
                                label: 'Duyệt rút tiền',
                                variant: 'primary',
                                disabled: actionId === item.id,
                                onClick: () => handleApprove(item),
                              },
                              {
                                icon: X,
                                label: 'Từ chối rút tiền',
                                variant: 'danger',
                                disabled: actionId === item.id,
                                onClick: () => handleReject(item),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        <div className="admin-pagination withdrawals-pagination">
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={total}
            label="phiếu"
            limit={limit}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      </section>

      {selected ? <WithdrawDetailDialog item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Modal, Table, Tag, message } from 'antd';

import {
  blockAccount,
  getAccountStatistics,
  listAccounts,
  unblockAccount,
} from '../../api/accountApi';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ShopCell from '../components/ShopCell';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { formatDateTime, statusTagColor } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  initialFilterValue,
  withAllFilterOption,
} from '../utils/filterOptions';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS = withAllFilterOption([
  { value: '1', label: 'Hoạt động' },
  { value: '0', label: 'Đã khóa' },
]);

const ROLE_OPTIONS = withAllFilterOption([
  { value: '1', label: 'Người mua' },
  { value: '2', label: 'Người bán' },
  { value: '3', label: 'Admin' },
]);

export default function UsersPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const urlSearch = useUrlQueryString('search');
  const [search, setSearch] = useState(urlSearch || '');
  const [status, setStatus] = useState(() => initialFilterValue(urlStatus));
  const [role, setRole] = useState(ALL_FILTER_VALUE);
  const [statistics, setStatistics] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      return listAccounts(token, {
        page,
        limit,
        search,
        status: apiFilterParam(status),
        role: apiFilterParam(role),
      });
    },
    [getIdToken, search, status, role]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, reload } =
    usePaginatedQuery({ fetcher, deps: [search, status, role] });

  const loadStatistics = useCallback(async () => {
    setStatsLoading(true);
    try {
      const token = await getIdToken();
      const payload = await getAccountStatistics(token);
      setStatistics(payload.data?.statistics || null);
    } catch {
      setStatistics(null);
    } finally {
      setStatsLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const statItems = useMemo(() => {
    const users = statistics?.users || {};
    return [
      { key: 'total', title: 'Tổng tài khoản', value: users.total ?? 0 },
      { key: 'buyers', title: 'Người mua', value: users.buyers ?? 0 },
      { key: 'sellers', title: 'Người bán', value: users.sellers ?? 0 },
      { key: 'active', title: 'Đang hoạt động', value: users.active ?? 0 },
      { key: 'blocked', title: 'Đã khóa', value: users.blocked ?? 0 },
    ];
  }, [statistics]);

  async function executeBlockToggle(record) {
    const accountId = record.id || record._id;
    const isBlocked = record.status === 0;
    setBusyId(accountId);
    try {
      const token = await getIdToken();
      if (isBlocked) {
        await unblockAccount(token, accountId);
        message.success('Đã mở khóa tài khoản');
      } else {
        await blockAccount(token, accountId);
        message.success('Đã khóa tài khoản');
      }
      await reload();
      await loadStatistics();
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    } finally {
      setBusyId('');
    }
  }

  function handleBlockToggle(record) {
    const isBlocked = record.status === 0;
    if (isBlocked) {
      Modal.confirm({
        title: 'Mở khóa tài khoản',
        content:
          'Người dùng sẽ đăng nhập và dùng FastMark bình thường. Gian hàng liên kết (nếu có) cũng được mở khóa.',
        okText: 'Xác nhận mở khóa',
        cancelText: 'Huỷ',
        okButtonProps: { className: 'unlock-confirm-btn' },
        onOk: () => executeBlockToggle(record),
      });
      return;
    }
    Modal.confirm({
      title: 'Khóa tài khoản',
      content:
        'Người dùng chỉ còn màn bị khóa trên app (rút tiền, khiếu nại, đăng xuất). Gian hàng cũng bị khóa và mọi đơn treo sẽ hủy hoàn cọc.',
      okText: 'Xác nhận khóa',
      cancelText: 'Huỷ',
      okType: 'danger',
      onOk: () => executeBlockToggle(record),
    });
  }

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, row) => (
        <ShopCell
          shopName={row.fullName || row.userName}
          shopUsername={row.fullName ? row.userName : ''}
          shopAvatar={row.avatar}
        />
      ),
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      render: (_, row) => (
        <div>
          <div>{row.email || '—'}</div>
          {row.phone ? (
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{row.phone}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (statusValue, row) => (
        <Tag color={statusTagColor(statusValue)}>
          {row.statusLabel || (statusValue === 1 ? 'Hoạt động' : 'Đã khóa')}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 168,
      render: formatDateTime,
    },
    {
      title: 'Lần hoạt động cuối',
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      width: 168,
      render: (value) => formatDateTime(value) || '—',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      render: (_, record) => {
        const accountId = record.id || record._id;
        const isBlocked = record.status === 0;
        return (
          <RowActions
            onView={() => navigate(`/users/${accountId}`)}
            onEdit={() => handleBlockToggle(record)}
            editLabel={isBlocked ? 'Mở khóa' : 'Khóa'}
            editLoading={busyId === accountId}
          />
        );
      },
    },
  ];

  return (
    <PageContainer
      title="Người dùng"
      subtitle="Quản lý tài khoản người mua, người bán và admin"
      stats={<StatCards items={statItems} loading={statsLoading} columns={5} />}
    >
      <ListToolbar
        searchPlaceholder="Tìm theo tên, email, SĐT..."
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
          {
            key: 'role',
            placeholder: 'Vai trò',
            options: ROLE_OPTIONS,
            value: role,
            onChange: (v) => {
              setRole(v);
              setPage(1);
            },
          },
        ]}
        onReset={() => {
          setSearch('');
          setStatus(ALL_FILTER_VALUE);
          setRole(ALL_FILTER_VALUE);
          setPage(1);
        }}
      />

      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Table
        rowKey={(row) => row.id || row._id}
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} tài khoản`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />
    </PageContainer>
  );
}

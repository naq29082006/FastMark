import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Input, Modal, Table, Tag, message } from 'antd';

import {
  approveVerification,
  listAdminVerifications,
  rejectVerification,
} from '../../api/sellerApi';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { formatDateTime, verificationStatusLabel } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '0', label: 'Chờ duyệt' },
  { value: '1', label: 'Đã duyệt' },
  { value: '2', label: 'Từ chối' },
];

function statusColor(status) {
  if (status === 1) return 'success';
  if (status === 2) return 'error';
  return 'warning';
}

export default function SellersPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(urlStatus);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listAdminVerifications(token, { page, limit, search, status });
      return {
        data: {
          items: payload.data?.verifications || [],
          pagination: payload.data?.pagination,
          stats: payload.data?.stats,
        },
      };
    },
    [getIdToken, search, status]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats, reload } =
    usePaginatedQuery({ fetcher, deps: [search, status] });

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng hồ sơ', value: stats?.total ?? 0 },
      { key: 'pending', title: 'Chờ duyệt', value: stats?.pending ?? 0 },
      { key: 'approved', title: 'Đã duyệt', value: stats?.approved ?? 0 },
      { key: 'rejected', title: 'Từ chối', value: stats?.rejected ?? 0 },
    ],
    [stats]
  );

  async function handleApprove(record) {
    const id = record.id || record._id;
    setActionLoading(id);
    try {
      const token = await getIdToken();
      await approveVerification(token, id);
      message.success('Đã duyệt hồ sơ người bán');
      await reload();
    } catch (err) {
      message.error(err.message || 'Không duyệt được hồ sơ');
    } finally {
      setActionLoading('');
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      message.warning('Vui lòng nhập lý do từ chối');
      return;
    }
    const id = rejectTarget.id || rejectTarget._id;
    setActionLoading(id);
    try {
      const token = await getIdToken();
      await rejectVerification(token, id, reason);
      message.success('Đã từ chối hồ sơ');
      setRejectTarget(null);
      setRejectReason('');
      await reload();
    } catch (err) {
      message.error(err.message || 'Không từ chối được hồ sơ');
    } finally {
      setActionLoading('');
    }
  }

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Gian hàng',
      dataIndex: 'shopName',
      key: 'shopName',
      render: (v) => v || '—',
    },
    {
      title: 'Chủ shop',
      key: 'owner',
      render: (_, row) =>
        row.user?.fullName || row.user?.userName || row.ownerName || '—',
    },
    {
      title: 'Xác minh',
      dataIndex: 'status',
      key: 'status',
      render: (v) => (
        <Tag color={statusColor(v)}>{verificationStatusLabel(v)}</Tag>
      ),
    },
    {
      title: 'Danh mục',
      key: 'category',
      render: (_, row) => row.categoryName || row.category?.name || '—',
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v, row) => formatDateTime(v || row.submittedAt),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 220,
      render: (_, record) => {
        const id = record.id || record._id;
        const isPending = record.status === 0;
        return (
          <div className="admin-row-actions">
            <RowActions
              onView={() => navigate(`/sellers/${id}`)}
              onEdit={isPending ? () => handleApprove(record) : undefined}
              editLabel="Duyệt"
              editLoading={actionLoading === id}
              onDelete={
                isPending
                  ? () => {
                      setRejectTarget(record);
                      setRejectReason('');
                    }
                  : undefined
              }
              deleteLabel="Từ chối"
            />
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer
      title="Người bán"
      subtitle="Duyệt hồ sơ đăng ký seller và quản lý gian hàng"
      stats={<StatCards items={statItems} loading={loading && !stats} columns={4} />}
    >
      <ListToolbar
        searchPlaceholder="Tìm theo tên shop, chủ shop..."
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        filters={[
          {
            key: 'status',
            placeholder: 'Trạng thái xác minh',
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
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} hồ sơ`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />

      <Modal
        title="Từ chối hồ sơ"
        open={Boolean(rejectTarget)}
        okText="Từ chối"
        okButtonProps={{ danger: true, loading: Boolean(actionLoading) }}
        onOk={handleRejectConfirm}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
      >
        <p>
          Từ chối hồ sơ của <strong>{rejectTarget?.shopName || 'seller'}</strong>?
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Lý do từ chối (bắt buộc)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </PageContainer>
  );
}

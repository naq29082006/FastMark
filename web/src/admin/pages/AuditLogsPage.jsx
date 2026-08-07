import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Table } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

import { apiRequest } from '../../api/client';
import PageContainer from '../components/PageContainer';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { formatDateTime } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

const ACTION_OPTIONS = [
  { value: 'ADMIN_REFUND_BUYER', label: 'Hoàn cọc cho người mua' },
  { value: 'ADMIN_RELEASE_SELLER', label: 'Giải ngân cọc cho người bán' },
  { value: 'ADMIN_REJECT_REPORT', label: 'Bác bỏ báo cáo' },
];

const ACTION_LABELS = Object.fromEntries(ACTION_OPTIONS.map((o) => [o.value, o.label]));

const DECISION_LABELS = {
  buyer_win: 'Người mua thắng',
  seller_win: 'Người bán thắng',
};

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const [action, setAction] = useState(undefined);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (action) params.set('action', action);
      const payload = await apiRequest(`/api/admin/audit-logs?${params}`, { token });
      return {
        data: {
          items: payload.data?.items || [],
          pagination: payload.data?.pagination,
        },
      };
    },
    [getIdToken, action]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit } = usePaginatedQuery({
    fetcher,
    deps: [action],
  });

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatDateTime,
    },
    {
      title: 'Admin',
      key: 'admin',
      render: (_, row) => {
        const admin = row.admin;
        if (!admin) return '—';
        return (
          <div>
            <div>{admin.fullName || admin.userName || '—'}</div>
            {admin.email ? (
              <div style={{ color: '#6b7280', fontSize: 12 }}>{admin.email}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      dataIndex: 'action',
      key: 'action',
      render: (v) => ACTION_LABELS[v] || v || '—',
    },
    {
      title: 'Kết quả',
      dataIndex: 'decision',
      key: 'decision',
      render: (v) => DECISION_LABELS[v] || v || '—',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Đơn hàng',
      key: 'reservation',
      width: 120,
      render: (_, row) =>
        row.reservationId ? (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/reservations/${row.reservationId}`)}
          >
            Xem
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <PageContainer
      title="Nhật ký hoạt động"
      subtitle="Lịch sử thao tác admin trên đơn hàng và tranh chấp"
    >
      <ListToolbar
        searchPlaceholder="Tìm kiếm..."
        searchValue=""
        onSearchChange={() => {}}
        filters={[
          {
            key: 'action',
            placeholder: 'Loại thao tác',
            options: ACTION_OPTIONS,
            value: action,
            onChange: (v) => {
              setAction(v);
              setPage(1);
            },
          },
        ]}
        onReset={() => {
          setAction(undefined);
          setPage(1);
        }}
      />

      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Table
        rowKey={(row) => row.id || row._id || `audit-${row.createdAt}-${row.action}`}
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} bản ghi`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />
    </PageContainer>
  );
}

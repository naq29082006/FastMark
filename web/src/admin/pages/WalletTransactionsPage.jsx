import { useCallback, useMemo, useState } from 'react';
import { Alert, Table, Tag } from 'antd';

import { getFinanceOverview } from '../../api/accountApi';
import PageContainer from '../components/PageContainer';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { formatCurrency, formatDateTime, walletTxTypeLabel } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

const TX_TYPE_OPTIONS = [
  { value: 'topup', label: 'Nạp tiền' },
  { value: 'withdrawal', label: 'Rút tiền' },
  { value: 'depositHold', label: 'Giữ cọc' },
  { value: 'depositRefund', label: 'Hoàn cọc' },
  { value: 'depositRelease', label: 'Giải ngân cọc' },
  { value: 'platformRevenue', label: 'Doanh thu nền tảng' },
];

const TX_TYPE_LABELS = Object.fromEntries(TX_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export default function WalletTransactionsPage() {
  const { getIdToken } = useAuth();
  const [detailType, setDetailType] = useState('topup');

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await getFinanceOverview(token, { detailType, page, limit });
      const data = payload.data || {};
      return {
        data: {
          items: data.table || [],
          pagination: data.pagination,
          stats: data.inRange,
        },
      };
    },
    [getIdToken, detailType]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats } =
    usePaginatedQuery({ fetcher, deps: [detailType] });

  const statItems = useMemo(() => {
    const bucket = stats?.[detailType] || {};
    return [
      {
        key: 'total',
        title: TX_TYPE_LABELS[detailType] || 'Giao dịch',
        value: formatCurrency(bucket.total),
        description: `${bucket.count ?? 0} giao dịch (30 ngày gần nhất)`,
      },
    ];
  }, [stats, detailType]);

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatDateTime,
    },
    {
      title: 'Loại',
      key: 'type',
      render: (_, row) => (
        <Tag>{row.typeLabel || walletTxTypeLabel(row.type) || TX_TYPE_LABELS[detailType]}</Tag>
      ),
    },
    {
      title: 'Tài khoản',
      key: 'account',
      render: (_, row) => row.fullName || row.userName || row.accountName || '—',
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'statusLabel',
      key: 'statusLabel',
      render: (v, row) => v || row.status || '—',
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v, row) => v || row.note || '—',
    },
  ];

  return (
    <PageContainer
      title="Giao dịch ví"
      subtitle="Lịch sử giao dịch ví theo loại"
      stats={<StatCards items={statItems} loading={loading && !stats} columns={2} />}
    >
      <ListToolbar
        filters={[
          {
            key: 'detailType',
            placeholder: 'Loại giao dịch',
            options: TX_TYPE_OPTIONS,
            value: detailType,
            onChange: (v) => {
              setDetailType(v || 'topup');
              setPage(1);
            },
          },
        ]}
        onReset={() => {
          setDetailType('topup');
          setPage(1);
        }}
      />

      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Table
        rowKey={(row) => row.id || row._id || row.transactionId || `tx-${row.CreatedAt}-${row.type}`}
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} giao dịch`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />
    </PageContainer>
  );
}

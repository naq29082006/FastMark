import { useCallback, useMemo, useState } from 'react';
import { Alert, Table, Tag } from 'antd';

import { getFinanceOverview } from '../../api/accountApi';
import PageContainer from '../components/PageContainer';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { formatCurrency, formatDateTime, walletTxTypeLabel } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  withAllFilterOption,
} from '../utils/filterOptions';
import { useAuth } from '../../context/AuthContext';

const TX_TYPE_OPTIONS = withAllFilterOption([
  { value: 'topup', label: 'Nạp tiền' },
  { value: 'withdrawal', label: 'Rút tiền' },
  { value: 'depositHold', label: 'Giữ cọc' },
  { value: 'depositRefund', label: 'Hoàn cọc' },
  { value: 'depositRelease', label: 'Giải ngân cọc' },
  { value: 'platformRevenue', label: 'Doanh thu nền tảng' },
]);

const TX_TYPE_LABELS = Object.fromEntries(TX_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export default function WalletTransactionsPage() {
  const { getIdToken } = useAuth();
  const [detailType, setDetailType] = useState(ALL_FILTER_VALUE);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await getFinanceOverview(token, {
        detailType: apiFilterParam(detailType) || 'all',
        page,
        limit,
      });
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
    if (detailType === ALL_FILTER_VALUE) {
      const topup = stats?.topup || {};
      const withdrawal = stats?.withdrawal || {};
      const depositHold = stats?.depositHold || {};
      const totalAmount =
        (Number(topup.total) || 0) +
        (Number(withdrawal.total) || 0) +
        (Number(depositHold.total) || 0) +
        (Number(stats?.depositRefund?.total) || 0) +
        (Number(stats?.depositRelease?.total) || 0) +
        (Number(stats?.platformRevenue?.total) || 0);
      const totalCount =
        (Number(topup.count) || 0) +
        (Number(withdrawal.count) || 0) +
        (Number(depositHold.count) || 0) +
        (Number(stats?.depositRefund?.count) || 0) +
        (Number(stats?.depositRelease?.count) || 0) +
        (Number(stats?.platformRevenue?.count) || 0);
      return [
        {
          key: 'total',
          title: 'Tất cả giao dịch',
          value: formatCurrency(totalAmount),
          description: `${totalCount} giao dịch (30 ngày gần nhất)`,
        },
      ];
    }
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
              setDetailType(v || ALL_FILTER_VALUE);
              setPage(1);
            },
          },
        ]}
        onReset={() => {
          setDetailType(ALL_FILTER_VALUE);
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

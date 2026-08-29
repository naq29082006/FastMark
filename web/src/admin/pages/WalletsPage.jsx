import { useCallback, useMemo } from 'react';
import { Alert, Table, Tag } from 'antd';

import { getFinanceOverview } from '../../api/accountApi';
import PageContainer from '../components/PageContainer';
import StatCards from '../components/StatCards';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { formatCurrency } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

export default function WalletsPage() {
  const { getIdToken } = useAuth();

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await getFinanceOverview(token, {
        detailType: 'allWallets',
        page,
        limit,
      });
      const data = payload.data || {};
      return {
        data: {
          items: data.table || [],
          pagination: data.pagination,
          stats: data.balances,
        },
      };
    },
    [getIdToken]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats } =
    usePaginatedQuery({ fetcher, deps: [] });

  const statItems = useMemo(() => {
    const b = stats || {};
    return [
      {
        key: 'buyerTotal',
        title: 'Tổng ví người mua',
        value: formatCurrency(b.buyerWalletTotal),
        description: `${b.buyerWalletCount ?? 0} ví`,
      },
      {
        key: 'sellerTotal',
        title: 'Tổng ví người bán',
        value: formatCurrency(b.sellerWalletTotal),
        description: `${b.sellerWalletCount ?? 0} ví`,
      },
      {
        key: 'all',
        title: 'Tổng số dư',
        value: formatCurrency((b.buyerWalletTotal ?? 0) + (b.sellerWalletTotal ?? 0)),
      },
    ];
  }, [stats]);

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Chủ ví',
      key: 'owner',
      render: (_, row) => (
        <div>
          <div>{row.fullName || row.userName || '—'}</div>
          {row.userName ? (
            <div style={{ color: '#6b7280', fontSize: 12 }}>@{row.userName}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'roleLabel',
      key: 'roleLabel',
      render: (v, row) => (
        <Tag color={row.role === 2 ? 'purple' : 'blue'}>{v || (row.role === 2 ? 'Người bán' : 'Người mua')}</Tag>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (v) => v || '—' },
    { title: 'SĐT', dataIndex: 'phone', key: 'phone', render: (v) => v || '—' },
    {
      title: 'Số dư',
      dataIndex: 'balance',
      key: 'balance',
      render: (v) => formatCurrency(v),
    },
  ];

  return (
    <PageContainer
      title="Ví điện tử"
      subtitle="Danh sách ví người mua và người bán"
      stats={<StatCards items={statItems} loading={loading && !stats} columns={3} />}
    >
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Table
        rowKey={(row) => row.walletId || row.userId || row.id || row._id}
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} ví`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />
    </PageContainer>
  );
}

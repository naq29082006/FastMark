import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Col, Row, Table } from 'antd';

import { getFinanceOverview } from '../../api/accountApi';
import PageContainer, { PanelCard } from '../components/PageContainer';
import StatCards from '../components/StatCards';
import { formatCurrency, formatDateTime } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

export default function SystemWalletPage() {
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [escrowPage, setEscrowPage] = useState(1);
  const escrowPageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getFinanceOverview(token, { detailType: 'escrow' });
      setData(payload.data || null);
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu ví hệ thống');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  const balances = data?.balances || {};
  const escrowItems = data?.details?.escrow || data?.table || [];

  const statItems = useMemo(
    () => [
      {
        key: 'systemWallet',
        title: 'Số dư ví hệ thống',
        value: formatCurrency(balances.escrowBalance),
        description: 'Tiền cọc / escrow đang giữ',
      },
      {
        key: 'buyerWallets',
        title: 'Tổng ví người mua',
        value: formatCurrency(balances.buyerWalletTotal),
        description: `${balances.buyerWalletCount ?? 0} ví`,
      },
      {
        key: 'sellerWallets',
        title: 'Tổng ví người bán',
        value: formatCurrency(balances.sellerWalletTotal),
        description: `${balances.sellerWalletCount ?? 0} ví`,
      },
      {
        key: 'escrowOrders',
        title: 'Đơn escrow đang treo',
        value: escrowItems.length,
      },
    ],
    [balances, escrowItems.length]
  );

  const escrowColumns = [
    buildSttColumn({ page: escrowPage, pageSize: escrowPageSize }),
    {
      title: 'Mã đơn',
      key: 'id',
      render: (_, row) => (row.id ? String(row.id).slice(-8).toUpperCase() : '—'),
    },
    { title: 'Sản phẩm', dataIndex: 'productName', key: 'productName', render: (v) => v || '—' },
    { title: 'Gian hàng', dataIndex: 'shopName', key: 'shopName', render: (v) => v || '—' },
    { title: 'Người mua', dataIndex: 'buyerName', key: 'buyerName', render: (v) => v || '—' },
    {
      title: 'Tiền cọc',
      dataIndex: 'depositAmount',
      key: 'depositAmount',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'statusLabel',
      key: 'statusLabel',
      render: (v) => v || '—',
    },
    {
      title: 'Ngày cọc',
      dataIndex: 'depositPaidAt',
      key: 'depositPaidAt',
      render: formatDateTime,
    },
  ];

  return (
    <PageContainer title="Ví hệ thống" subtitle="Số dư escrow và đơn cọc đang treo">
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <StatCards items={statItems} loading={loading} columns={4} />

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <PanelCard title="Đơn cọc đang treo (escrow)">
            <Table
              rowKey={(row) => row.id || row.reservationId || `escrow-${row.reservationId || row.createdAt}`}
              loading={loading}
              columns={escrowColumns}
              dataSource={escrowItems}
              pagination={{
                current: escrowPage,
                pageSize: escrowPageSize,
                showTotal: (total) => `${total} đơn`,
                onChange: (page) => setEscrowPage(page),
              }}
              scroll={{ x: 900 }}
            />
          </PanelCard>
        </Col>
      </Row>
    </PageContainer>
  );
}

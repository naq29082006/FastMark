import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Table,
  Typography,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  LockOutlined,
  WalletOutlined,
} from '@ant-design/icons';

import { getFinanceOverview } from '../../api/accountApi';
import PageContainer, { PanelCard } from '../components/PageContainer';
import ListToolbar from '../components/ListToolbar';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatNumber } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  withAllFilterOption,
} from '../utils/filterOptions';
import {
  buildFinanceDetailColumns,
  financeDetailTitle,
} from '../finance/financeDetailColumns';

const { Text } = Typography;

const ROLE_OPTIONS = withAllFilterOption([
  { value: '1', label: 'Người mua' },
  { value: '2', label: 'Người bán' },
]);

const SEARCH_PLACEHOLDERS = {
  allWallets: 'Tìm họ tên, @username, email, SĐT...',
  topup: 'Tìm mã GD, username, mã đơn...',
  withdrawal: 'Tìm mã GD, username, mã rút, STK...',
  escrow: 'Tìm mã đơn, sản phẩm, gian hàng, người mua...',
};

function FinanceMetricCard({ label, value, detail, icon, tone = 'green', active, onClick }) {
  return (
    <button
      type="button"
      className={`admin-finance-metric tone-${tone}${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <div className="admin-finance-metric-icon">{icon}</div>
      <div className="admin-finance-metric-body">
        <span className="admin-finance-metric-label">{label}</span>
        <strong className="admin-finance-metric-value">{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </button>
  );
}

const FINANCE_METRICS = [
  {
    key: 'walletTotal',
    detailType: 'allWallets',
    label: 'Tổng số dư ví',
    tone: 'green',
    icon: <WalletOutlined />,
    value: (d) => formatCurrency(d?.summary?.walletTotal),
    detail: (d) => `${formatNumber(d?.summary?.walletCount)} ví`,
  },
  {
    key: 'topup',
    detailType: 'topup',
    label: 'Tổng tiền nạp',
    tone: 'blue',
    icon: <ArrowDownOutlined />,
    value: (d) => formatCurrency(d?.summary?.topupTotal),
    detail: (d) => `${formatNumber(d?.summary?.topupCount)} giao dịch`,
  },
  {
    key: 'withdrawal',
    detailType: 'withdrawal',
    label: 'Tổng tiền rút',
    tone: 'orange',
    icon: <ArrowUpOutlined />,
    value: (d) => formatCurrency(d?.summary?.withdrawTotal),
    detail: (d) => `${formatNumber(d?.summary?.withdrawCount)} giao dịch`,
  },
  {
    key: 'escrow',
    detailType: 'escrow',
    label: 'Tiền chờ giải ngân',
    tone: 'purple',
    icon: <LockOutlined />,
    value: (d) => formatCurrency(d?.summary?.escrowHeldTotal),
    detail: (d) => `${formatNumber(d?.summary?.escrowHeldCount)} đơn giữ cọc`,
  },
];

export default function FinancePage() {
  const { getIdToken } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState('walletTotal');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState(ALL_FILTER_VALUE);

  const selectedMetric = useMemo(
    () => FINANCE_METRICS.find((metric) => metric.key === selectedKey) || null,
    [selectedKey]
  );

  const detailType = selectedMetric?.detailType || 'allWallets';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getFinanceOverview(token, {
        allTime: 1,
        detailType: selectedMetric?.detailType || 'allWallets',
        page,
        limit,
        search,
        role: apiFilterParam(role),
      });
      setData(payload.data || payload);
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu tài chính');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMetric, page, limit, search, role, getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  function selectMetric(key) {
    setPage(1);
    setSearch('');
    setRole(ALL_FILTER_VALUE);
    setSelectedKey(key);
  }

  function handleResetFilters() {
    setSearch('');
    setRole(ALL_FILTER_VALUE);
    setPage(1);
  }

  const tableRows = data?.table || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };
  const detailColumns = buildFinanceDetailColumns(detailType);
  const searchPlaceholder = SEARCH_PLACEHOLDERS[detailType] || 'Tìm kiếm...';

  return (
    <PageContainer title="Tài chính hệ thống" subtitle="Chọn thẻ để xem danh sách chi tiết tương ứng">
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <div className="admin-finance-metric-grid">
        {FINANCE_METRICS.map((metric) => (
          <FinanceMetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value(data || {})}
            detail={metric.detail(data || {})}
            icon={metric.icon}
            tone={metric.tone}
            active={selectedKey === metric.key}
            onClick={() => selectMetric(metric.key)}
          />
        ))}
      </div>

      <div className="admin-finance-detail">
        <PanelCard
          title={financeDetailTitle(detailType)}
          extra={
            <Text type="secondary">
              {pagination.total ? `Tổng ${formatNumber(pagination.total)} mục` : 'Không có dữ liệu'}
            </Text>
          }
        >
          <ListToolbar
            searchValue={search}
            onSearchChange={setSearch}
            onSearch={() => setPage(1)}
            searchPlaceholder={searchPlaceholder}
            filters={[
              {
                key: 'role',
                label: 'Vai trò',
                placeholder: 'Vai trò',
                value: role,
                onChange: (value) => {
                  setRole(value || ALL_FILTER_VALUE);
                  setPage(1);
                },
                options: ROLE_OPTIONS,
              },
            ]}
            onReset={handleResetFilters}
          />
          <Table
            rowKey={(row) => row.id || row._id || row.orderCode || JSON.stringify(row)}
            loading={loading}
            dataSource={tableRows}
            scroll={{ x: 960 }}
            columns={[buildSttColumn({ page, pageSize: limit }), ...detailColumns]}
            pagination={{
              current: page,
              pageSize: limit,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `${total} mục`,
              onChange: (nextPage, nextLimit) => {
                setPage(nextPage);
                setLimit(nextLimit);
              },
            }}
          />
        </PanelCard>
      </div>
    </PageContainer>
  );
}

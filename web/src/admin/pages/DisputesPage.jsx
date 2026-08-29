import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Space, Table, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import { approveReport, dismissReport, getReportDetail, listReports } from '../../api/reportApi';
import ReportDetailPanel from '../components/ReportDetailPanel';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ShopCell from '../components/ShopCell';
import ProductCell from '../components/ProductCell';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { formatDateTime } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  withAllFilterOption,
} from '../utils/filterOptions';
import { useAuth } from '../../context/AuthContext';

const REPORT_STATUS_OPTIONS = withAllFilterOption([
  { value: '0', label: 'Chờ xử lý' },
  { value: '1', label: 'Đã xử lý' },
  { value: '2', label: 'Đã bác bỏ' },
]);

const REPORT_TYPES = {
  1: 'Đánh giá',
  2: 'Gian hàng',
  3: 'Sản phẩm',
  4: 'Hệ thống lỗi',
  5: 'Khác',
  6: 'Khiếu nại khóa tài khoản',
  7: 'Khiếu nại khóa gian hàng',
  8: 'Hệ thống lỗi',
  9: 'Khác',
  10: 'Khiếu nại khóa tài khoản',
  11: 'Khiếu nại khóa gian hàng',
};

function reportTypeLabel(record) {
  return record.reportTypeLabel || REPORT_TYPES[record.reportType] || `Loại ${record.reportType}`;
}

function ReportTargetCell({ row, navigate }) {
  const product = row.product;
  const shop = row.shop;
  const targetUser = row.targetUser;

  if (product?.id && product?.name) {
    return (
      <ProductCell
        productName={product.name}
        productImage={product.image}
        onClick={() => navigate(`/products/${product.id}`)}
      />
    );
  }

  if (shop?.id && (shop?.name || shop?.shopUsername)) {
    return (
      <ShopCell
        shopName={shop.name}
        shopUsername={shop.shopUsername}
        avatar={shop.avatar}
        onClick={() => navigate(`/sellers/shops/${shop.id}`)}
      />
    );
  }

  if (targetUser?.id || targetUser?.fullName || targetUser?.userName) {
    return (
      <ShopCell
        shopName={targetUser.fullName || targetUser.userName}
        shopUsername={targetUser.fullName ? targetUser.userName : ''}
        avatar={targetUser.avatar}
        onClick={targetUser.id ? () => navigate(`/users/${targetUser.id}`) : undefined}
      />
    );
  }

  return row.targetSubjectLabel || '—';
}

function statusTag(status) {
  if (status === 0) {
    return <Tag color="orange">Chờ xử lý</Tag>;
  }
  if (status === 1) {
    return <Tag color="green">Đã xử lý</Tag>;
  }
  return <Tag color="red">Đã bác bỏ</Tag>;
}

export default function DisputesPage() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL_FILTER_VALUE);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMode, setActionMode] = useState(null);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listReports(token, {
        page,
        limit,
        search,
        status: apiFilterParam(status),
      });
      const data = payload?.data || payload || {};
      return {
        data: {
          items: data.items || [],
          pagination: data.pagination,
          stats: data.stats,
        },
      };
    },
    [getIdToken, search, status]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats, reload } =
    usePaginatedQuery({
      fetcher,
      deps: [search, status],
    });

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng', value: stats?.total ?? 0 },
      { key: 'pending', title: 'Chờ xử lý', value: stats?.pending ?? 0 },
      { key: 'processed', title: 'Đã xử lý', value: stats?.processed ?? 0 },
      { key: 'rejected', title: 'Đã bác bỏ', value: stats?.rejected ?? 0 },
    ],
    [stats]
  );

  async function openDetail(record) {
    setSelected(record);
    setReply('');
    setActionMode(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const token = await getIdToken();
      const payload = await getReportDetail(token, record.id || record._id);
      setSelected(payload?.data?.report || payload?.data || payload || record);
    } catch (err) {
      message.error(err.message || 'Không tải được chi tiết khiếu nại');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelected(null);
    setReply('');
    setActionMode(null);
  }

  function navigateFromDetail(path) {
    closeDetail();
    navigate(path);
  }

  function openAction(mode) {
    setReply('');
    setActionMode(mode);
  }

  async function submitAction() {
    if (!selected || !actionMode) return;
    setActionLoading(true);
    try {
      const token = await getIdToken();
      const id = selected.id || selected._id;
      if (actionMode === 'approve') {
        await approveReport(token, id, 'approve', reply);
        message.success('Đã xử lý khiếu nại');
      } else {
        await dismissReport(token, id, reply);
        message.success('Đã bác bỏ khiếu nại');
      }
      setActionMode(null);
      setReply('');
      closeDetail();
      reload();
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  const columns = [
    buildSttColumn({ page, pageSize: limit }),
    {
      title: 'Báo cáo',
      dataIndex: 'title',
      key: 'title',
      render: (value, row) => value || row.reasonLabel || row.content?.slice(0, 80) || '—',
    },
    {
      title: 'Loại',
      dataIndex: 'reportType',
      key: 'reportType',
      width: 120,
      render: (_, row) => reportTypeLabel(row),
    },
    {
      title: 'Người gửi',
      key: 'reporter',
      width: 200,
      render: (_, row) => {
        const reporter = row.reporter;
        if (!reporter) {
          return row.reporterName || row.userName || '—';
        }
        return (
          <ShopCell
            shopName={reporter.fullName || reporter.userName}
            shopUsername={reporter.fullName ? reporter.userName : ''}
            avatar={reporter.avatar}
            onClick={reporter.id ? () => navigate(`/users/${reporter.id}`) : undefined}
          />
        );
      },
    },
    {
      title: 'Đối tượng',
      key: 'target',
      width: 240,
      render: (_, row) => <ReportTargetCell row={row} navigate={navigate} />,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (value, row) => statusTag(value ?? row.status),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value, row) => formatDateTime(value || row.CreatedAt),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <RowActions onView={() => openDetail(record)} viewLabel="Chi tiết" />
      ),
    },
  ];

  const detailTitle =
    selected?.title || selected?.reasonLabel || 'Chi tiết khiếu nại';

  return (
    <PageContainer
      title="Khiếu nại"
      subtitle="Đánh giá, gian hàng, sản phẩm, lỗi hệ thống, khiếu nại khóa tài khoản/gian hàng. Tranh chấp đơn hàng xử lý tại Đơn hàng."
      stats={<StatCards items={statItems} loading={loading && !stats} columns={4} />}
    >
      <ListToolbar
        searchPlaceholder="Tìm theo tiêu đề, người gửi, nội dung..."
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        filters={[
          {
            key: 'status',
            placeholder: 'Trạng thái',
            value: status,
            onChange: (v) => {
              setStatus(v || ALL_FILTER_VALUE);
              setPage(1);
            },
            options: REPORT_STATUS_OPTIONS,
          },
        ]}
        onReset={() => {
          setSearch('');
          setStatus(ALL_FILTER_VALUE);
          setPage(1);
        }}
      />

      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Table
        rowKey={(row) => row.id || row._id}
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 1100 }}
        locale={{ emptyText: loading ? ' ' : 'Chưa có khiếu nại nội dung' }}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} khiếu nại`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />

      <Modal
        open={detailOpen}
        centered
        title={detailTitle}
        onCancel={closeDetail}
        width={640}
        destroyOnClose
        footer={
          selected?.status === 0 ? (
            <Space>
              <Button onClick={closeDetail}>Đóng</Button>
              <Button onClick={() => openAction('dismiss')}>Bác bỏ</Button>
              <Button type="primary" onClick={() => openAction('approve')}>
                Xử lý
              </Button>
            </Space>
          ) : (
            <Button type="primary" onClick={closeDetail}>
              Đóng
            </Button>
          )
        }
      >
        {detailLoading && !selected ? (
          <p>Đang tải...</p>
        ) : (
          <ReportDetailPanel report={selected} onNavigate={navigateFromDetail} />
        )}
      </Modal>

      <Modal
        open={Boolean(actionMode)}
        centered
        title={actionMode === 'approve' ? 'Xử lý khiếu nại' : 'Bác bỏ khiếu nại'}
        onCancel={() => {
          setActionMode(null);
          setReply('');
        }}
        onOk={submitAction}
        okText={actionMode === 'approve' ? 'Xử lý' : 'Bác bỏ'}
        okButtonProps={{
          danger: actionMode === 'dismiss',
          loading: actionLoading,
        }}
        confirmLoading={actionLoading}
      >
        <Input.TextArea
          rows={3}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Phản hồi / ghi chú gửi người dùng (tuỳ chọn)"
        />
      </Modal>
    </PageContainer>
  );
}

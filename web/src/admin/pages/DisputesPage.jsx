import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Space, Table, Tag, message } from 'antd';

import { approveReport, dismissReport, getReportDetail, listReports } from '../../api/reportApi';
import AdminDetailModal from '../components/AdminDetailModal';
import ReportDetailPanel from '../components/ReportDetailPanel';
import PageContainer from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { formatDateTime } from '../utils/format';
import { buildSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

const REPORT_TYPES = {
  1: 'Đánh giá',
  2: 'Gian hàng',
  3: 'Sản phẩm',
  4: 'Hệ thống',
  5: 'Khác',
  6: 'Khiếu nại khóa TK',
  7: 'Khiếu nại khóa shop',
  8: 'Hệ thống lỗi',
  9: 'Khác',
  10: 'Khiếu nại khóa TK',
  11: 'Khiếu nại khóa shop',
};

function reportTypeLabel(record) {
  return record.reportTypeLabel || REPORT_TYPES[record.reportType] || `Loại ${record.reportType}`;
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
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      return listReports(token, { page, limit, search });
    },
    [getIdToken, search]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, reload } =
    usePaginatedQuery({
      fetcher,
      deps: [search],
    });

  async function openDetail(record) {
    setSelected(record);
    setReply('');
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

  async function handleDismiss() {
    setActionLoading(true);
    try {
      const token = await getIdToken();
      await dismissReport(token, selected.id || selected._id, reply);
      message.success('Đã bác bỏ khiếu nại');
      setDetailOpen(false);
      reload();
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    setActionLoading(true);
    try {
      const token = await getIdToken();
      await approveReport(token, selected.id || selected._id, 'approve', reply);
      message.success('Đã xử lý khiếu nại');
      setDetailOpen(false);
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
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      render: (value, row) => value || row.reasonLabel || row.content?.slice(0, 80) || '—',
    },
    {
      title: 'Loại',
      dataIndex: 'reportType',
      key: 'reportType',
      render: (_, row) => reportTypeLabel(row),
    },
    {
      title: 'Người gửi',
      key: 'reporter',
      render: (_, row) =>
        row.reporter?.fullName || row.reporter?.userName || row.reporterName || row.userName || '—',
    },
    {
      title: 'Đối tượng',
      key: 'target',
      render: (_, row) =>
        row.targetSubjectLabel ||
        row.targetProductName ||
        row.targetShopName ||
        row.target_product_name ||
        row.target_shop_name ||
        '—',
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
        <div className="admin-row-actions">
          <RowActions onView={() => openDetail(record)} viewLabel="Chi tiết" />
          {record.reservationId ? (
            <Button type="link" size="small" onClick={() => navigate(`/reservations/${record.reservationId}`)}>
              Đơn
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const detailFooter =
    selected?.status === 0 ? (
      <Space wrap className="admin-detail-modal-footer">
        <Input.TextArea
          rows={2}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Phản hồi / ghi chú admin (tuỳ chọn)"
          style={{ minWidth: 280, maxWidth: 480 }}
        />
        <Button onClick={handleDismiss} loading={actionLoading}>
          Bác bỏ
        </Button>
        <Button type="primary" onClick={handleApprove} loading={actionLoading}>
          Duyệt xử lý
        </Button>
      </Space>
    ) : (
      <Button onClick={() => setDetailOpen(false)}>Đóng</Button>
    );

  return (
    <PageContainer title="Khiếu nại & tố cáo" subtitle="Xử lý báo cáo nội dung từ người dùng">
      <ListToolbar
        searchPlaceholder="Tìm theo tiêu đề, người gửi, nội dung..."
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        onReset={() => {
          setSearch('');
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
        locale={{ emptyText: loading ? ' ' : 'Chưa có báo cáo' }}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} báo cáo`,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
      />

      <AdminDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.title || selected?.reasonLabel || 'Chi tiết báo cáo'}
        subtitle={selected ? reportTypeLabel(selected) : ''}
        loading={detailLoading}
        footer={detailFooter}
        fullscreen
      >
        <ReportDetailPanel report={selected} />
      </AdminDetailModal>
    </PageContainer>
  );
}

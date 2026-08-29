import { useCallback, useState } from 'react';
import { Alert, Button, Input, Modal, Space, Table, Tag, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { approveReport, dismissReport, listReports } from '../../api/reportApi';
import PageContainer from '../components/PageContainer';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { formatDateTime } from '../utils/format';
import { withSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

const REPORT_TYPES = {
  1: 'Đánh giá',
  2: 'Gian hàng',
  3: 'Sản phẩm',
  4: 'Hệ thống',
  5: 'Khác',
  6: 'Khiếu nại khóa TK',
  7: 'Khiếu nại khóa shop',
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      return listReports(token, { page, limit, search });
    },
    [getIdToken, search]
  );

  const { items, loading, error, pagination, page, setPage, limit, reload } = usePaginatedQuery({
    fetcher,
    deps: [search],
  });

  function openDetail(record) {
    setSelected(record);
    setReply('');
    setDetailOpen(true);
  }

  async function handleDismiss() {
    try {
      const token = await getIdToken();
      await dismissReport(token, selected.id || selected._id, reply);
      message.success('Đã bác bỏ báo cáo');
      setDetailOpen(false);
      reload();
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    }
  }

  async function handleApprove() {
    try {
      const token = await getIdToken();
      await approveReport(token, selected.id || selected._id, 'approve', reply);
      message.success('Đã xử lý báo cáo');
      setDetailOpen(false);
      reload();
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    }
  }

  return (
    <PageContainer title="Báo cáo nội dung" subtitle="Model: Report">
      <ListToolbar searchValue={search} onSearchChange={setSearch} onSearch={setSearch} searchPlaceholder="Tìm báo cáo..." />
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
      <Table
        rowKey={(r) => r.id || r._id}
        loading={loading}
        dataSource={items}
        pagination={{ current: page, pageSize: limit, total: pagination.total, onChange: setPage }}
        columns={withSttColumn(
          [
          { title: 'Báo cáo', dataIndex: 'title' },
          {
            title: 'Loại',
            dataIndex: 'reportType',
            render: (v) => REPORT_TYPES[v] || v,
          },
          {
            title: 'Người gửi',
            key: 'reporter',
            render: (_, r) =>
              r.reporter?.fullName || r.reporter?.userName || r.reporterName || r.userName || '—',
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (v) => <Tag color={v === 0 ? 'orange' : v === 1 ? 'green' : 'red'}>{v === 0 ? 'Chờ' : v === 1 ? 'Đã xử lý' : 'Bác bỏ'}</Tag>,
          },
          { title: 'Ngày tạo', dataIndex: 'createdAt', render: (v, r) => formatDateTime(v || r.CreatedAt) },
          {
            title: 'Thao tác',
            render: (_, record) => (
              <Space>
                <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
                  Chi tiết
                </Button>
                {record.reservationId ? (
                  <Button size="small" type="link" onClick={() => navigate(`/reservations/${record.reservationId}`)}>
                    Đơn
                  </Button>
                ) : null}
              </Space>
            ),
          },
        ],
          { page, pageSize: limit }
        )}
      />
      <Modal
        open={detailOpen}
        title="Chi tiết báo cáo"
        onCancel={() => setDetailOpen(false)}
        footer={
          <Space>
            <Button onClick={handleDismiss}>Bác bỏ</Button>
            <Button type="primary" onClick={handleApprove}>
              Duyệt xử lý
            </Button>
          </Space>
        }
      >
        <p>{selected?.content}</p>
        <Input.TextArea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Phản hồi admin" />
      </Modal>
    </PageContainer>
  );
}

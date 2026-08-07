import { useCallback, useState } from 'react';
import { Alert, Button, Input, Modal, Space, Table, Tag, message } from 'antd';

import { approveAdminWithdraw, listAdminWithdraws, rejectAdminWithdraw } from '../../api/bankApi';
import PageContainer from '../components/PageContainer';
import ListToolbar from '../components/ListToolbar';
import StatCards from '../components/StatCards';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { formatCurrency, formatDateTime } from '../utils/format';
import { withSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

const STATUS = {
  0: { label: 'Chờ duyệt', color: 'orange' },
  1: { label: 'Đã duyệt', color: 'green' },
  2: { label: 'Từ chối', color: 'red' },
};

export default function WithdrawalsPage() {
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(urlStatus);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('approve');

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      return listAdminWithdraws(token, { page, limit, search, status });
    },
    [getIdToken, search, status]
  );

  const { items, loading, error, pagination, page, setPage, limit, reload } = usePaginatedQuery({
    fetcher,
    deps: [search, status],
  });

  const stats = [
    { key: 'total', title: 'Tổng yêu cầu', value: pagination.total || 0 },
    { key: 'pending', title: 'Chờ duyệt', value: items.filter((i) => i.status === 0).length },
  ];

  function openAction(record, action) {
    setSelected(record);
    setMode(action);
    setNote('');
    setNoteOpen(true);
  }

  async function submitAction() {
    try {
      const token = await getIdToken();
      const id = selected.id || selected._id;
      if (mode === 'approve') {
        await approveAdminWithdraw(token, id, { adminNote: note });
        message.success('Đã duyệt rút tiền');
      } else {
        await rejectAdminWithdraw(token, id, { adminNote: note });
        message.success('Đã từ chối');
      }
      setNoteOpen(false);
      reload();
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    }
  }

  return (
    <PageContainer title="Rút tiền" subtitle="Model: WithdrawRequest" stats={<StatCards items={stats} loading={loading} />}>
      <ListToolbar searchValue={search} onSearchChange={setSearch} onSearch={setSearch} searchPlaceholder="Tìm người yêu cầu..." />
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
      <Table
        rowKey={(r) => r.id || r._id}
        loading={loading}
        dataSource={items}
        pagination={{ current: page, pageSize: limit, total: pagination.total, onChange: setPage }}
        columns={withSttColumn(
          [
          { title: 'Người yêu cầu', dataIndex: 'accountName', render: (v, r) => v || r.userName || '—' },
          { title: 'Ngân hàng', dataIndex: 'bankName' },
          { title: 'STK', dataIndex: 'accountNumber' },
          { title: 'Chủ TK', dataIndex: 'accountName' },
          { title: 'Số tiền', dataIndex: 'amount', render: formatCurrency },
          { title: 'Ngày tạo', dataIndex: 'createdAt', render: (v, r) => formatDateTime(v || r.CreatedAt) },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (v) => {
              const meta = STATUS[v] || { label: String(v), color: 'default' };
              return <Tag color={meta.color}>{meta.label}</Tag>;
            },
          },
          {
            title: 'Thao tác',
            render: (_, record) =>
              record.status === 0 ? (
                <Space>
                  <Button size="small" type="primary" onClick={() => openAction(record, 'approve')}>
                    Duyệt
                  </Button>
                  <Button size="small" danger onClick={() => openAction(record, 'reject')}>
                    Từ chối
                  </Button>
                </Space>
              ) : null,
          },
        ],
          { page, pageSize: limit }
        )}
      />
      <Modal
        open={noteOpen}
        title={mode === 'approve' ? 'Duyệt rút tiền' : 'Từ chối rút tiền'}
        onCancel={() => setNoteOpen(false)}
        onOk={submitAction}
      >
        <Input.TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú / lý do" />
      </Modal>
    </PageContainer>
  );
}

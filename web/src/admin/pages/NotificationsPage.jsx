import { useCallback, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Select, Table, Tag, message } from 'antd';

import { getBroadcastHistory, sendSystemNotification } from '../../api/notificationApi';
import PageContainer, { PanelCard } from '../components/PageContainer';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { formatDateTime } from '../utils/format';
import { withSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

export default function NotificationsPage() {
  const { getIdToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      return getBroadcastHistory(token, { page, limit });
    },
    [getIdToken]
  );

  const { items, loading, error, pagination, page, setPage, limit, reload } = usePaginatedQuery({ fetcher });

  async function handleSend() {
    try {
      const values = await form.validateFields();
      const token = await getIdToken();
      await sendSystemNotification(token, values);
      message.success('Đã gửi thông báo');
      setOpen(false);
      form.resetFields();
      reload();
    } catch (err) {
      message.error(err.message || 'Gửi thông báo thất bại');
    }
  }

  return (
    <PageContainer
      title="Thông báo"
      subtitle="Model: Notification"
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          Gửi thông báo
        </Button>
      }
    >
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
      <PanelCard title="Lịch sử gửi">
        <Table
          rowKey={(r) => r.id || r._id || `notice-${r.title}-${r.CreatedAt}`}
          loading={loading}
          dataSource={items}
          pagination={{ current: page, pageSize: limit, total: pagination.total, onChange: setPage }}
          columns={withSttColumn(
            [
            { title: 'Tiêu đề', dataIndex: 'title' },
            { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
            {
              title: 'Đối tượng',
              dataIndex: 'audience',
              render: (v) => <Tag>{v || 'system'}</Tag>,
            },
            { title: 'Ngày gửi', dataIndex: 'sentAt', render: (v, r) => formatDateTime(v || r.CreatedAt || r.createdAt) },
          ],
            { page, pageSize: limit }
          )}
        />
      </PanelCard>

      <Modal title="Gửi thông báo hệ thống" open={open} onCancel={() => setOpen(false)} onOk={handleSend}>
        <Form form={form} layout="vertical" initialValues={{ audience: 'all' }}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="Nội dung" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="audience" label="Nhóm nhận" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'all', label: 'Toàn hệ thống' },
                { value: 'buyer', label: 'Người dùng' },
                { value: 'seller', label: 'Người bán' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

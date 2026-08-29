import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Table, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import {
  createAdminBank,
  deleteAdminBank,
  listAdminBanks,
  updateAdminBank,
} from '../api/bankApi';
import PageContainer, { PanelCard } from '../admin/components/PageContainer';
import RowActions from '../admin/components/RowActions';
import { formatDateTime } from '../admin/utils/format';
import { withSttColumn } from '../admin/utils/tableColumns';
import { useAuth } from '../context/AuthContext';

export default function BanksPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 10;
  const [form] = Form.useForm();

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listAdminBanks(token);
      setItems(payload.data?.banks || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách ngân hàng.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function openModal(record = null) {
    setEditing(record);
    form.setFieldsValue(
      record
        ? { name: record.name || '', code: record.code || '' }
        : { name: '', code: '' }
    );
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function saveBank() {
    const values = await form.validateFields();
    const name = String(values.name || '').trim();
    const code = String(values.code || '').trim().toUpperCase();

    setSaving(true);
    try {
      const token = await getIdToken();
      const payload = { name, code };

      if (editing?.id) {
        await updateAdminBank(token, editing.id, payload);
        message.success('Đã cập nhật ngân hàng');
      } else {
        const result = await createAdminBank(token, payload);
        message.success(result.message || 'Đã thêm ngân hàng');
      }

      closeModal();
      await loadItems();
    } catch (submitError) {
      message.error(submitError.message || 'Không lưu được ngân hàng.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(record) {
    Modal.confirm({
      title: 'Xóa ngân hàng',
      content: (
        <>
          Xóa <strong>{record.name}</strong>? Ngân hàng sẽ ẩn khỏi admin và app. Thêm lại đúng mã{' '}
          <strong>{record.code}</strong> sẽ tự khôi phục.
        </>
      ),
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Huỷ',
      onOk: async () => {
        const token = await getIdToken();
        await deleteAdminBank(token, record.id);
        message.success('Đã xóa ngân hàng');
        await loadItems();
      },
    });
  }

  return (
    <PageContainer
      title="Ngân hàng"
      subtitle="Danh sách ngân hàng hỗ trợ rút tiền trên app"
    >
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <PanelCard
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm ngân hàng
          </Button>
        }
      >
        <Table
          rowKey={(row) => row.id}
          loading={loading}
          dataSource={items}
          pagination={{
            current: tablePage,
            pageSize: tablePageSize,
            onChange: (page) => setTablePage(page),
            showTotal: (total) => `${total} ngân hàng`,
          }}
          locale={{
            emptyText: 'Chưa có ngân hàng. Thêm ít nhất một ngân hàng để user rút tiền.',
          }}
          columns={withSttColumn(
            [
              { title: 'Tên ngân hàng', dataIndex: 'name', ellipsis: true },
              {
                title: 'Mã',
                dataIndex: 'code',
                width: 96,
                render: (value) => (
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                    {value || '—'}
                  </span>
                ),
              },
              {
                title: 'Ngày tạo',
                dataIndex: 'createdAt',
                width: 168,
                render: (value) => formatDateTime(value) || '—',
              },
              {
                title: 'Thao tác',
                width: 120,
                render: (_, record) => (
                  <RowActions
                    onEdit={() => openModal(record)}
                    onDelete={() => confirmDelete(record)}
                  />
                ),
              },
            ],
            { page: tablePage, pageSize: tablePageSize }
          )}
        />
      </PanelCard>

      <Modal
        open={open}
        title={editing ? 'Sửa ngân hàng' : 'Thêm ngân hàng'}
        onCancel={closeModal}
        onOk={saveBank}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label="Tên ngân hàng"
            rules={[{ required: true, message: 'Vui lòng nhập tên ngân hàng' }]}
          >
            <Input placeholder="Vietcombank" />
          </Form.Item>
          <Form.Item
            name="code"
            label="Mã ngân hàng"
            rules={[
              { required: true, message: 'Vui lòng nhập mã' },
              { min: 2, message: 'Mã phải từ 2 ký tự' },
            ]}
          >
            <Input placeholder="VCB" maxLength={16} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}

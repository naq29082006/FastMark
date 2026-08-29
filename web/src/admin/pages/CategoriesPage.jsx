import { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Table, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';

import { createCategory, deleteCategory, listCategories, updateCategory } from '../../api/categoryApi';
import PageContainer, { PanelCard } from '../components/PageContainer';
import RowActions from '../components/RowActions';
import { withSttColumn } from '../utils/tableColumns';
import { formatDateTime } from '../utils/format';
import { useAuth } from '../../context/AuthContext';

function renderCategoryCell(row) {
  const name = row.name || row.categoryName || '—';
  const desc = (row.description || '').trim();
  return (
    <div className="admin-shop-cell-text">
      <div className="admin-shop-cell-name">{name}</div>
      {desc ? (
        <div className="admin-shop-cell-handle admin-category-desc" title={desc}>
          {desc}
        </div>
      ) : null}
    </div>
  );
}

export default function CategoriesPage() {
  const { getIdToken } = useAuth();
  const [params] = useSearchParams();
  const type = params.get('type') === 'products' ? 'products' : 'shops';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 10;
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const payload = await listCategories(token, type);
      setItems(payload.data?.categories || payload.data?.items || []);
    } catch (err) {
      message.error(err.message || 'Không tải danh mục');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, type]);

  useEffect(() => {
    load();
  }, [load]);

  function openModal(record = null) {
    setEditing(record);
    form.setFieldsValue(
      record
        ? {
            name: record.name || record.categoryName || '',
            description: record.description || '',
            disputeDays: record.disputeDays ?? 7,
          }
        : { name: '', description: '', disputeDays: 7 }
    );
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function saveCategory() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const token = await getIdToken();
      const payload = {
        name: values.name.trim(),
        description: (values.description || '').trim(),
      };

      if (type === 'products') {
        payload.disputeDays = Number(values.disputeDays) || 7;
      }

      if (editing) {
        await updateCategory(token, type, editing.id || editing._id, payload);
        message.success('Đã cập nhật danh mục');
      } else {
        const response = await createCategory(token, type, payload);
        message.success(response.message || 'Đã thêm danh mục');
      }

      closeModal();
      load();
    } catch (err) {
      message.error(err.message || 'Lưu danh mục thất bại');
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteCategory(record) {
    const name = record.name || record.categoryName || 'danh mục này';
    Modal.confirm({
      title: 'Xóa danh mục',
      content: `Bạn có chắc muốn xóa "${name}"? Thao tác này không thể hoàn tác.`,
      okText: 'Xác nhận xóa',
      cancelText: 'Huỷ',
      okType: 'danger',
      onOk: async () => {
        const token = await getIdToken();
        await deleteCategory(token, type, record.id || record._id);
        message.success('Đã xóa danh mục');
        load();
      },
    });
  }

  const pageTitle =
    type === 'products' ? 'Danh mục sản phẩm' : 'Danh mục shop';

  return (
    <PageContainer title={pageTitle} subtitle="ProductCategory · ShopCategory">
      <PanelCard
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm danh mục
          </Button>
        }
      >
        <Table
          rowKey={(r) => r.id || r._id}
          loading={loading}
          dataSource={items}
          pagination={{ current: tablePage, pageSize: tablePageSize, onChange: (p) => setTablePage(p) }}
          columns={withSttColumn(
            [
              {
                title: 'Danh mục',
                key: 'category',
                render: (_, row) => renderCategoryCell(row),
              },
              type === 'products'
                ? {
                    title: 'Bảo vệ đơn',
                    dataIndex: 'disputeDays',
                    key: 'disputeDays',
                    width: 112,
                    align: 'center',
                    render: (value) => (value != null && value !== '' ? `${value} ngày` : '—'),
                  }
                : null,
              {
                title: 'Ngày tạo',
                key: 'createdAt',
                width: 168,
                render: (_, row) => formatDateTime(row.createdAt || row.CreatedAt) || '—',
              },
              {
                title: 'Thao tác',
                width: 140,
                render: (_, record) => (
                  <RowActions
                    onEdit={() => openModal(record)}
                    onDelete={() => confirmDeleteCategory(record)}
                  />
                ),
              },
            ].filter(Boolean),
            { page: tablePage, pageSize: tablePageSize }
          )}
        />
      </PanelCard>
      <Modal
        open={open}
        title={editing ? 'Sửa danh mục' : 'Thêm danh mục'}
        onCancel={closeModal}
        onOk={saveCategory}
        confirmLoading={saving}
        okText="Lưu"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Vui lòng nhập tên danh mục' }]}>
            <Input placeholder="VD: Trái cây, Thời trang..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn về danh mục" />
          </Form.Item>
          {type === 'products' ? (
            <Form.Item name="disputeDays" label="Số ngày bảo vệ đơn">
              <Input type="number" min={1} max={30} />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </PageContainer>
  );
}

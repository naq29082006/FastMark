import { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Table, Tabs, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';

import { createCategory, deleteCategory, listCategories, updateCategory } from '../../api/categoryApi';
import PageContainer, { PanelCard } from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ShopCategoryPinIcon from '../components/ShopCategoryPinIcon';
import { withSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

export default function CategoriesPage() {
  const { getIdToken } = useAuth();
  const [params, setParams] = useSearchParams();
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
        categoryName: values.name.trim(),
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

  return (
    <PageContainer title="Danh mục" subtitle="ProductCategory · ShopCategory">
      <Tabs
        activeKey={type}
        onChange={(key) => setParams({ type: key })}
        items={[
          { key: 'shops', label: 'Danh mục shop' },
          { key: 'products', label: 'Danh mục sản phẩm' },
        ]}
      />
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
              { title: 'Tên', dataIndex: 'name', render: (_, row) => row.name || row.categoryName },
              { title: 'Mô tả', dataIndex: 'description', ellipsis: true },
              type === 'products'
                ? { title: 'Ngày bảo vệ đơn', dataIndex: 'disputeDays' }
                : {
                    title: 'Icon',
                    dataIndex: 'icon',
                    width: 88,
                    render: () => <ShopCategoryPinIcon size="card" />,
                  },
              {
                title: 'Thao tác',
                width: 140,
                render: (_, record) => (
                  <RowActions
                    onEdit={() => openModal(record)}
                    onDelete={() =>
                      Modal.confirm({
                        title: 'Xóa danh mục?',
                        okType: 'danger',
                        onOk: async () => {
                          const token = await getIdToken();
                          await deleteCategory(token, type, record.id || record._id);
                          message.success('Đã xóa danh mục');
                          load();
                        },
                      })
                    }
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
          ) : (
            <Form.Item label="Icon danh mục">
              <div className="admin-shop-category-pin-preview">
                <ShopCategoryPinIcon size="card" />
                <span>Ghim vị trí FastMark — đồng bộ bản đồ (#16A34A)</span>
              </div>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </PageContainer>
  );
}

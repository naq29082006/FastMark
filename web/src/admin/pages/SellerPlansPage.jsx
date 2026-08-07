import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import {
  createSellerPlan,
  deleteSellerPlan,
  listSellerPlans,
  listSellerSubscriptions,
  updateSellerPlan,
} from '../../api/sellerPlanApi';
import PageContainer, { PanelCard } from '../components/PageContainer';
import RowActions from '../components/RowActions';
import ShopCell from '../components/ShopCell';
import StatCards from '../components/StatCards';
import ListToolbar from '../components/ListToolbar';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { extractPlansList } from '../utils/apiNormalize';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';
import { withSttColumn } from '../utils/tableColumns';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { name: '', description: '', durationDays: 30, price: 0, isActive: true };

const SUBSCRIPTION_STATUS = {
  0: { color: 'orange', label: 'Chờ thanh toán' },
  1: { color: 'green', label: 'Đang hiệu lực' },
  2: { color: 'default', label: 'Hết hạn' },
  3: { color: 'red', label: 'Đã hủy' },
};

function SellerPlansTab() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 10;
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listSellerPlans(token);
      setItems(extractPlansList(payload));
    } catch (err) {
      const messageText = err.message || 'Không tải được gói dịch vụ';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    form.setFieldsValue(emptyForm);
    setOpen(true);
  }

  function openEdit(record) {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      durationDays: record.durationDays,
      price: record.price,
      isActive: record.isActive === 1 || record.isActive === true,
    });
    setOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    const token = await getIdToken();
    const body = { ...values, isActive: values.isActive ? 1 : 0 };
    try {
      if (editing) {
        await updateSellerPlan(token, editing.id || editing._id, body);
        message.success('Đã cập nhật gói');
      } else {
        await createSellerPlan(token, body);
        message.success('Đã thêm gói');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.message || 'Lưu thất bại');
    }
  }

  async function handleDelete(record) {
    Modal.confirm({
      title: 'Xóa gói dịch vụ?',
      content: record.name,
      okType: 'danger',
      onOk: async () => {
        const token = await getIdToken();
        await deleteSellerPlan(token, record.id || record._id);
        message.success('Đã xóa gói');
        load();
      },
    });
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm gói
        </Button>
      </div>
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
      <PanelCard>
        <Table
          rowKey={(r) => r.id || r._id}
          loading={loading}
          dataSource={items}
          pagination={{ current: tablePage, pageSize: tablePageSize, onChange: (p) => setTablePage(p) }}
          columns={withSttColumn(
            [
              { title: 'Tên gói', dataIndex: 'name', key: 'name' },
              { title: 'Giá', dataIndex: 'price', key: 'price', render: formatCurrency },
              {
                title: 'Thời hạn (ngày)',
                dataIndex: 'durationDays',
                key: 'durationDays',
                render: formatNumber,
              },
              {
                title: 'Trạng thái',
                dataIndex: 'isActive',
                key: 'isActive',
                render: (v) => (
                  <Tag color={v === 1 || v === true ? 'green' : 'default'}>
                    {v === 1 || v === true ? 'Đang bán' : 'Tắt'}
                  </Tag>
                ),
              },
              {
                title: 'Thao tác',
                width: 140,
                render: (_, record) => (
                  <RowActions onEdit={() => openEdit(record)} onDelete={() => handleDelete(record)} />
                ),
              },
            ],
            { page: tablePage, pageSize: tablePageSize }
          )}
        />
      </PanelCard>

      <Modal
        title={editing ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="Lưu"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên gói" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="durationDays" label="Thời hạn (ngày)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="price" label="Giá (VNĐ)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="Bật gói" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function SellerSubscriptionsTab() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(urlStatus);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listSellerSubscriptions(token, { page, limit, search, status });
      const data = payload.data || payload || {};
      return {
        data: {
          items: data.items || [],
          pagination: data.pagination,
          stats: data.summary,
        },
      };
    },
    [getIdToken, search, status]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats } =
    usePaginatedQuery({
      fetcher,
      deps: [search, status],
    });

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng lượt đăng ký', value: stats?.total ?? pagination.total ?? 0 },
      { key: 'shops', title: 'Shop đã mua gói', value: stats?.uniqueShops ?? 0 },
      { key: 'active', title: 'Đang hiệu lực', value: stats?.active ?? 0 },
      {
        key: 'revenue',
        title: 'Doanh thu tích lũy',
        value: formatCurrency(stats?.totalRevenue ?? 0),
      },
    ],
    [stats, pagination.total]
  );

  return (
    <>
      <StatCards items={statItems} loading={loading && !stats} columns={4} />
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        searchPlaceholder="Tìm shop, gói, người bán..."
        filters={[
          {
            key: 'status',
            placeholder: 'Trạng thái',
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: Object.entries(SUBSCRIPTION_STATUS).map(([value, meta]) => ({
              value,
              label: meta.label,
            })),
          },
        ]}
        onReset={() => {
          setSearch('');
          setStatus(undefined);
          setPage(1);
        }}
      />
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
      <Table
        rowKey={(r) => r.id || r._id}
        loading={loading}
        dataSource={items}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize: limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `${total} lượt đăng ký`,
          onChange: (p, ps) => {
            setPage(p);
            setLimit(ps);
          },
        }}
        columns={withSttColumn(
          [
            {
              title: 'Gian hàng',
              key: 'shop',
              width: 220,
              render: (_, row) => (
                <ShopCell
                  shopName={row.shop?.shopName || row.shopName}
                  shopUsername={row.shop?.shopUsername || row.shopUsername}
                  shopAvatar={row.shop?.avatar || row.shopAvatar}
                  onClick={
                    row.shopId || row.shop?.id
                      ? () => navigate(`/sellers/shops/${row.shopId || row.shop?.id}`)
                      : undefined
                  }
                />
              ),
            },
            { title: 'Gói', dataIndex: 'planName', key: 'planName' },
            { title: 'Ngày mua', dataIndex: 'ngayMua', key: 'ngayMua', render: formatDateTime },
            { title: 'Hết hạn', dataIndex: 'endDate', key: 'endDate', render: formatDateTime },
            { title: 'Số tiền', dataIndex: 'amount', key: 'amount', render: formatCurrency },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              key: 'status',
              render: (v) => {
                const meta = SUBSCRIPTION_STATUS[v] || { color: 'default', label: String(v) };
                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              title: 'Thao tác',
              width: 80,
              fixed: 'right',
              render: (_, row) => (
                <RowActions
                  onView={
                    row.shopId || row.shop?.id
                      ? () => navigate(`/sellers/shops/${row.shopId || row.shop?.id}`)
                      : undefined
                  }
                />
              ),
            },
          ],
          { page, pageSize: limit }
        )}
      />
    </>
  );
}

export default function SellerPlansPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'plans';

  return (
    <PageContainer>
      <Tabs
        activeKey={tab}
        onChange={(key) => setParams({ tab: key })}
        items={[
          { key: 'plans', label: 'Gói dịch vụ', children: <SellerPlansTab /> },
          { key: 'history', label: 'Lịch sử đăng ký', children: <SellerSubscriptionsTab /> },
        ]}
      />
    </PageContainer>
  );
}

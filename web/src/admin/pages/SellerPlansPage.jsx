import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Table,
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
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  initialFilterValue,
  withAllFilterOption,
} from '../utils/filterOptions';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { name: '', description: '', durationDays: 30, price: 0 };

const SUBSCRIPTION_STATUS = {
  0: { color: 'orange', label: 'Chờ thanh toán' },
  1: { color: 'green', label: 'Đang hiệu lực' },
  2: { color: 'default', label: 'Hết hạn' },
  3: { color: 'red', label: 'Đã hủy' },
};

const SUBSCRIPTION_STATUS_FILTER_OPTIONS = [
  { value: '1', label: 'Đang hiệu lực' },
  { value: '2', label: 'Hết hạn' },
];

function SellerPlansTab() {
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
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const token = await getIdToken();
      if (editing) {
        await updateSellerPlan(token, editing.id || editing._id, values);
        message.success('Đã cập nhật gói');
      } else {
        await createSellerPlan(token, values);
        message.success('Đã thêm gói');
      }
      closeModal();
      load();
    } catch (err) {
      message.error(err.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(record) {
    Modal.confirm({
      title: 'Xóa gói dịch vụ',
      content: `Bạn có chắc muốn xóa "${record.name}"? Gói sẽ được ẩn khỏi hệ thống.`,
      okText: 'Xác nhận xóa',
      cancelText: 'Huỷ',
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
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
      <PanelCard
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm gói
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
              { title: 'Tên gói', dataIndex: 'name', key: 'name' },
              { title: 'Giá', dataIndex: 'price', key: 'price', render: formatCurrency },
              {
                title: 'Thời hạn (ngày)',
                dataIndex: 'durationDays',
                key: 'durationDays',
                render: formatNumber,
              },
              {
                title: 'Thao tác',
                width: 140,
                render: (_, record) => (
                  <RowActions onEdit={() => openEdit(record)} onDelete={() => confirmDelete(record)} />
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
        onCancel={closeModal}
        onOk={handleSubmit}
        confirmLoading={saving}
        okText="Lưu"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên gói" rules={[{ required: true, message: 'Vui lòng nhập tên gói' }]}>
            <Input placeholder="VD: Gói 1 tháng" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả quyền lợi gói bán" />
          </Form.Item>
          <Form.Item name="durationDays" label="Thời hạn (ngày)" rules={[{ required: true, message: 'Vui lòng nhập thời hạn' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="price" label="Giá (VNĐ)" rules={[{ required: true, message: 'Vui lòng nhập giá gói' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
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
  const [status, setStatus] = useState(() => initialFilterValue(urlStatus));

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listSellerSubscriptions(token, {
        page,
        limit,
        search,
        status: apiFilterParam(status),
      });
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
            options: withAllFilterOption(SUBSCRIPTION_STATUS_FILTER_OPTIONS),
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
  const [params] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'plans';
  const title = tab === 'history' ? 'Lịch sử gói bán' : 'Gói bán';

  return (
    <PageContainer title={title}>
      {tab === 'history' ? <SellerSubscriptionsTab /> : <SellerPlansTab />}
    </PageContainer>
  );
}

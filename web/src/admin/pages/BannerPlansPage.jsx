import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Form,
  Image,
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
  approveSellerBanner,
  cancelSellerBanner,
  createBannerPlan,
  deleteBannerPlan,
  listBannerPlans,
  listSellerBanners,
  rejectSellerBanner,
  updateBannerPlan,
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
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

const BANNER_STATUS = {
  0: { label: 'Chưa treo', color: 'default' },
  1: { label: 'Đang treo', color: 'green' },
  2: { label: 'Đã hủy', color: 'red' },
  3: { label: 'Từ chối', color: 'orange' },
  4: { label: 'Chờ duyệt', color: 'blue' },
};

function BannerPlansTab() {
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
      const payload = await listBannerPlans(token);
      setItems(extractPlansList(payload));
    } catch (err) {
      const messageText = err.message || 'Không tải được gói banner';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  function openModal(record = null) {
    setEditing(record);
    form.setFieldsValue(
      record
        ? {
            name: record.name,
            description: record.description,
            durationDays: record.durationDays,
            price: record.price,
            isActive: record.isActive === 1 || record.isActive === true,
          }
        : { name: '', description: '', durationDays: 7, price: 0, isActive: true }
    );
    setOpen(true);
  }

  async function savePlan() {
    const values = await form.validateFields();
    const token = await getIdToken();
    const body = { ...values, isActive: values.isActive ? 1 : 0 };
    try {
      if (editing) {
        await updateBannerPlan(token, editing.id || editing._id, body);
        message.success('Đã cập nhật');
      } else {
        await createBannerPlan(token, body);
        message.success('Đã thêm gói banner');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.message || 'Lưu thất bại');
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
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
              { title: 'Tên gói', dataIndex: 'name' },
              { title: 'Giá', dataIndex: 'price', render: formatCurrency },
              { title: 'Thời hạn', dataIndex: 'durationDays', render: (v) => `${formatNumber(v)} ngày` },
              {
                title: 'Trạng thái',
                dataIndex: 'isActive',
                render: (v) => (
                  <Tag color={v === 1 || v === true ? 'green' : 'default'}>{v ? 'Bật' : 'Tắt'}</Tag>
                ),
              },
              {
                title: 'Thao tác',
                width: 140,
                render: (_, record) => (
                  <RowActions
                    onEdit={() => openModal(record)}
                    onDelete={() =>
                      Modal.confirm({
                        title: 'Xóa gói banner?',
                        okType: 'danger',
                        onOk: async () => {
                          const token = await getIdToken();
                          await deleteBannerPlan(token, record.id || record._id);
                          message.success('Đã xóa gói');
                          load();
                        },
                      })
                    }
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
        title={editing ? 'Sửa gói banner' : 'Thêm gói banner'}
        onCancel={() => setOpen(false)}
        onOk={savePlan}
        okText="Lưu"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="durationDays" label="Thời hạn (ngày)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="price" label="Giá" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="Bật" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function BannerHistoryTab() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(urlStatus);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selected, setSelected] = useState(null);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listSellerBanners(token, { page, limit, search, status });
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

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats, reload } =
    usePaginatedQuery({
      fetcher,
      deps: [search, status],
    });

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng lượt đăng ký', value: stats?.total ?? pagination.total ?? 0 },
      { key: 'shops', title: 'Shop đã mua banner', value: stats?.uniqueShops ?? 0 },
      { key: 'active', title: 'Đang treo', value: stats?.active ?? 0 },
      {
        key: 'revenue',
        title: 'Doanh thu tích lũy',
        value: formatCurrency(stats?.totalRevenue ?? 0),
      },
    ],
    [stats, pagination.total]
  );

  async function handleApprove(record) {
    try {
      const token = await getIdToken();
      await approveSellerBanner(token, record.id || record._id);
      message.success('Đã duyệt banner');
      reload();
    } catch (err) {
      message.error(err.message || 'Duyệt banner thất bại');
    }
  }

  function openReject(record) {
    setSelected(record);
    setRejectReason('');
    setRejectOpen(true);
  }

  async function submitReject() {
    try {
      const token = await getIdToken();
      await rejectSellerBanner(token, selected.id || selected._id, { reason: rejectReason });
      message.success('Đã từ chối banner');
      setRejectOpen(false);
      reload();
    } catch (err) {
      message.error(err.message || 'Từ chối banner thất bại');
    }
  }

  return (
    <>
      <StatCards items={statItems} loading={loading && !stats} columns={4} />
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        searchPlaceholder="Tìm shop / banner..."
        filters={[
          {
            key: 'status',
            placeholder: 'Trạng thái',
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: Object.entries(BANNER_STATUS).map(([value, meta]) => ({
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
              title: 'Ảnh',
              dataIndex: 'image',
              width: 90,
              render: (v) =>
                v ? (
                  <Image src={resolveMediaUrl(v)} width={72} height={40} style={{ objectFit: 'cover' }} />
                ) : (
                  '—'
                ),
            },
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
            { title: 'Gói', dataIndex: 'planName' },
            { title: 'Giá', dataIndex: 'amount', render: formatCurrency },
            { title: 'Bắt đầu', dataIndex: 'startDate', render: formatDateTime },
            { title: 'Kết thúc', dataIndex: 'endDate', render: formatDateTime },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (v) => {
                const meta = BANNER_STATUS[v] || { label: String(v), color: 'default' };
                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              title: 'Thao tác',
              width: 200,
              fixed: 'right',
              render: (_, record) => (
                <div className="admin-row-actions">
                  {record.shopId || record.shop?.id ? (
                    <RowActions
                      onView={() => navigate(`/sellers/shops/${record.shopId || record.shop?.id}`)}
                    />
                  ) : null}
                  {record.status === 4 ? (
                    <>
                      <Button type="link" size="small" onClick={() => handleApprove(record)}>
                        Duyệt
                      </Button>
                      <Button type="link" size="small" danger onClick={() => openReject(record)}>
                        Từ chối
                      </Button>
                    </>
                  ) : null}
                  {record.status === 1 ? (
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={async () => {
                        try {
                          const token = await getIdToken();
                          await cancelSellerBanner(token, record.id || record._id);
                          message.success('Đã gỡ banner');
                          reload();
                        } catch (err) {
                          message.error(err.message || 'Gỡ banner thất bại');
                        }
                      }}
                    >
                      Gỡ
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ],
          { page, pageSize: limit }
        )}
      />
      <Modal open={rejectOpen} title="Từ chối banner" onCancel={() => setRejectOpen(false)} onOk={submitReject}>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Lý do từ chối"
        />
      </Modal>
    </>
  );
}

export default function BannerPlansPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'plans';

  return (
    <PageContainer>
      <Tabs
        activeKey={tab}
        onChange={(key) => setParams({ tab: key })}
        items={[
          { key: 'plans', label: 'Gói Banner', children: <BannerPlansTab /> },
          { key: 'history', label: 'Lịch sử đăng ký', children: <BannerHistoryTab /> },
        ]}
      />
    </PageContainer>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Table,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Check, Eye, Monitor, Trash2, X } from 'lucide-react';

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
import HomeBannerPreviewPanel from '../../components/admin/HomeBannerPreviewPanel';
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
import { notifyAdminPendingCountsChanged } from '../utils/pendingCountsRefresh';
import PreviewableImage from '../../components/PreviewableImage';
import TableIconActions from '../../components/ui/TableIconActions';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  initialFilterValue,
  withAllFilterOption,
} from '../utils/filterOptions';

const BANNER_STATUS = {
  0: { label: 'Chưa yêu cầu treo', color: 'default' },
  1: { label: 'Đang treo', color: 'green' },
  2: { label: 'Đã hủy', color: 'red' },
  3: { label: 'Từ chối', color: 'orange' },
  4: { label: 'Chờ duyệt treo', color: 'blue' },
};

const BANNER_LIFECYCLE_FILTER_OPTIONS = [
  { value: 'active', label: 'Đang chạy' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'purchased', label: 'Chưa yêu cầu treo' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const BANNER_STATUS_FILTER_OPTIONS = withAllFilterOption(BANNER_LIFECYCLE_FILTER_OPTIONS);

const DEFAULT_BANNER_MANAGE_LIFECYCLE = 'active';

function mapBannerPreviewRow(row) {
  if (!row) return null;
  return {
    ...row,
    image: row.image ? resolveMediaUrl(row.image) : '',
  };
}

function BannerManageTab({ onMutate }) {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState(() =>
    initialFilterValue(urlStatus, DEFAULT_BANNER_MANAGE_LIFECYCLE)
  );
  const [previewRow, setPreviewRow] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activePreviewBanners, setActivePreviewBanners] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listSellerBanners(token, {
        page,
        limit,
        search,
        filter: apiFilterParam(lifecycleFilter),
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
    [getIdToken, search, lifecycleFilter]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats, reload } =
    usePaginatedQuery({
      fetcher,
      deps: [search, lifecycleFilter],
    });

  const loadActivePreviewBanners = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const token = await getIdToken();
      const payload = await listSellerBanners(token, { page: 1, limit: 100, filter: 'active' });
      const rows = (payload.data?.items || []).map(mapBannerPreviewRow);
      setActivePreviewBanners(rows);
    } catch {
      setActivePreviewBanners([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadActivePreviewBanners();
  }, [loadActivePreviewBanners]);

  useEffect(() => {
    if (!items.length) {
      setPreviewRow(null);
      return;
    }
    setPreviewRow((current) => {
      if (current && items.some((row) => String(row.id) === String(current.id))) {
        return mapBannerPreviewRow(items.find((row) => String(row.id) === String(current.id)));
      }
      const firstWithImage = items.find((row) => row.image);
      return mapBannerPreviewRow(firstWithImage || items[0]);
    });
  }, [items]);

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng', value: stats?.total ?? 0 },
      { key: 'pending', title: 'Chờ duyệt', value: stats?.pending ?? 0 },
      { key: 'running', title: 'Đang chạy', value: stats?.active ?? 0 },
      { key: 'expired', title: 'Hết hạn', value: stats?.expired ?? 0 },
      { key: 'purchased', title: 'Chưa treo', value: stats?.purchased ?? 0 },
    ],
    [stats]
  );

  async function afterMutation() {
    reload();
    loadActivePreviewBanners();
    onMutate?.();
  }

  async function handleApprove(record) {
    try {
      const token = await getIdToken();
      await approveSellerBanner(token, record.id || record._id);
      message.success('Đã duyệt banner');
      await afterMutation();
    } catch (err) {
      message.error(err.message || 'Duyệt banner thất bại');
    }
  }

  function openReject(record) {
    setRejectTarget(record);
    setRejectReason('');
    setRejectOpen(true);
  }

  async function submitReject() {
    try {
      const token = await getIdToken();
      await rejectSellerBanner(token, rejectTarget.id || rejectTarget._id, { reason: rejectReason });
      message.success('Đã từ chối banner');
      setRejectOpen(false);
      await afterMutation();
    } catch (err) {
      message.error(err.message || 'Từ chối banner thất bại');
    }
  }

  function openDetail(record) {
    setDetailRow(record);
    setDetailOpen(true);
  }

  const previewBanner = mapBannerPreviewRow(previewRow);

  return (
    <>
      <StatCards items={statItems} loading={loading && !stats} columns={5} />
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        searchPlaceholder="Tìm shop / banner..."
        filters={[
          {
            key: 'lifecycle',
            placeholder: 'Trạng thái',
            value: lifecycleFilter,
            onChange: (v) => {
              setLifecycleFilter(v || ALL_FILTER_VALUE);
              setPage(1);
            },
            options: BANNER_STATUS_FILTER_OPTIONS,
          },
        ]}
        onReset={() => {
          setSearch('');
          setLifecycleFilter(DEFAULT_BANNER_MANAGE_LIFECYCLE);
          setPage(1);
        }}
      />
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <div className="banner-home-layout admin-banner-manage-layout">
        <div className="banner-home-main">
          <Table
            rowKey={(r) => r.id || r._id}
            loading={loading}
            dataSource={items}
            scroll={{ x: 'max-content' }}
            rowClassName={(record) =>
              previewRow && String(previewRow.id) === String(record.id) ? 'banner-home-row is-selected' : 'banner-home-row'
            }
            onRow={(record) => ({
              onClick: () => setPreviewRow(mapBannerPreviewRow(record)),
            })}
            pagination={{
              current: page,
              pageSize: limit,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `${total} banner`,
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
                      <PreviewableImage
                        src={v}
                        width={72}
                        height={40}
                        shape="rounded"
                        onClick={(event) => event.stopPropagation()}
                      />
                    ) : (
                      '—'
                    ),
                },
                {
                  title: 'Gian hàng',
                  key: 'shop',
                  width: 200,
                  render: (_, row) => (
                    <span onClick={(e) => e.stopPropagation()}>
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
                    </span>
                  ),
                },
                { title: 'Gói', dataIndex: 'planName', width: 120 },
                { title: 'Giá', dataIndex: 'amount', width: 100, render: formatCurrency },
                {
                  title: 'Trạng thái',
                  dataIndex: 'status',
                  width: 130,
                  render: (v, row) => {
                    const meta = BANNER_STATUS[v] || { label: row.lifecycleLabel || String(v), color: 'default' };
                    return <Tag color={meta.color}>{meta.label}</Tag>;
                  },
                },
                {
                  title: 'Thao tác',
                  key: 'actions',
                  width: 96,
                  align: 'center',
                  render: (_, record) => (
                    <div onClick={(e) => e.stopPropagation()}>
                      <TableIconActions
                        actions={[
                          {
                            icon: Monitor,
                            label: 'Xem thử',
                            onClick: () => setPreviewRow(mapBannerPreviewRow(record)),
                          },
                          {
                            icon: Eye,
                            label: 'Chi tiết',
                            onClick: () => openDetail(record),
                          },
                          record.status === 4
                            ? {
                                icon: Check,
                                label: 'Duyệt',
                                variant: 'primary',
                                onClick: () => handleApprove(record),
                              }
                            : null,
                          record.status === 4
                            ? {
                                icon: X,
                                label: 'Từ chối',
                                variant: 'danger',
                                onClick: () => openReject(record),
                              }
                            : null,
                          record.status === 1
                            ? {
                                icon: Trash2,
                                label: 'Gỡ banner',
                                variant: 'danger',
                                onClick: async () => {
                                  try {
                                    const token = await getIdToken();
                                    await cancelSellerBanner(token, record.id || record._id);
                                    message.success('Đã gỡ banner');
                                    await afterMutation();
                                  } catch (err) {
                                    message.error(err.message || 'Gỡ banner thất bại');
                                  }
                                },
                              }
                            : null,
                        ]}
                      />
                    </div>
                  ),
                },
              ],
              { page, pageSize: limit }
            )}
          />
        </div>

        <HomeBannerPreviewPanel
          banner={previewBanner}
          activeBanners={activePreviewBanners}
          loading={previewLoading}
        />
      </div>

      <Modal open={detailOpen} title="Chi tiết banner" footer={null} onCancel={() => setDetailOpen(false)} width={640}>
        {detailRow ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Mã">{detailRow.id}</Descriptions.Item>
            <Descriptions.Item label="Gian hàng">
              {detailRow.shop?.shopName || '—'}{' '}
              {detailRow.shop?.shopUsername ? `@${detailRow.shop.shopUsername}` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="Gói">{detailRow.planName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Giá">{formatCurrency(detailRow.amount)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {BANNER_STATUS[detailRow.status]?.label || detailRow.lifecycleLabel || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Bắt đầu">{formatDateTime(detailRow.startDate) || '—'}</Descriptions.Item>
            <Descriptions.Item label="Kết thúc">{formatDateTime(detailRow.endDate) || '—'}</Descriptions.Item>
            <Descriptions.Item label="Click">{Number(detailRow.clickCount) || 0}</Descriptions.Item>
            {detailRow.lyDoVP ? (
              <Descriptions.Item label="Lý do từ chối">{detailRow.lyDoVP}</Descriptions.Item>
            ) : null}
          </Descriptions>
        ) : null}
      </Modal>

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

function BannerHistoryTab({ onMutate }) {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState(() => initialFilterValue(urlStatus));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selected, setSelected] = useState(null);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listSellerBanners(token, {
        page,
        limit,
        search,
        filter: apiFilterParam(lifecycleFilter),
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
    [getIdToken, search, lifecycleFilter]
  );

  const { items, loading, error, pagination, page, setPage, limit, setLimit, stats, reload } =
    usePaginatedQuery({
      fetcher,
      deps: [search, lifecycleFilter],
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

  async function afterMutation() {
    reload();
    onMutate?.();
  }

  async function handleApprove(record) {
    try {
      const token = await getIdToken();
      await approveSellerBanner(token, record.id || record._id);
      message.success('Đã duyệt banner');
      await afterMutation();
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
      await afterMutation();
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
            value: lifecycleFilter,
            onChange: (v) => {
              setLifecycleFilter(v || ALL_FILTER_VALUE);
              setPage(1);
            },
            options: BANNER_STATUS_FILTER_OPTIONS,
          },
        ]}
        onReset={() => {
          setSearch('');
          setLifecycleFilter(ALL_FILTER_VALUE);
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
          showTotal: (total) => `${total} banner`,
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
                  <PreviewableImage
                    src={v}
                    width={72}
                    height={40}
                    shape="rounded"
                    onClick={(event) => event.stopPropagation()}
                  />
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
              width: 160,
              fixed: 'right',
              render: (_, record) => (
                <div className="admin-row-actions">
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

function BannerPlansTab() {
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
          }
        : { name: '', description: '', durationDays: 7, price: 0 }
    );
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function savePlan() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const token = await getIdToken();
      if (editing) {
        await updateBannerPlan(token, editing.id || editing._id, values);
        message.success('Đã cập nhật');
      } else {
        await createBannerPlan(token, values);
        message.success('Đã thêm gói banner');
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
      title: 'Xóa gói banner',
      content: `Bạn có chắc muốn xóa "${record.name}"? Gói sẽ được ẩn khỏi hệ thống.`,
      okText: 'Xác nhận xóa',
      cancelText: 'Huỷ',
      okType: 'danger',
      onOk: async () => {
        const token = await getIdToken();
        await deleteBannerPlan(token, record.id || record._id);
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
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
              { title: 'Tên gói', dataIndex: 'name' },
              { title: 'Giá', dataIndex: 'price', render: formatCurrency },
              { title: 'Thời hạn', dataIndex: 'durationDays', render: (v) => `${formatNumber(v)} ngày` },
              {
                title: 'Thao tác',
                width: 140,
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
        title={editing ? 'Sửa gói banner' : 'Thêm gói banner'}
        onCancel={closeModal}
        onOk={savePlan}
        confirmLoading={saving}
        okText="Lưu"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên gói" rules={[{ required: true, message: 'Vui lòng nhập tên gói' }]}>
            <Input placeholder="VD: Banner 1 tháng" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Mô tả quyền lợi gói banner" />
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

export default function BannerPlansPage() {
  const [params] = useSearchParams();
  const { getIdToken } = useAuth();

  const handleBannerMutate = useCallback(() => {
    notifyAdminPendingCountsChanged();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await getIdToken();
        notifyAdminPendingCountsChanged();
      } catch {
        // ignore
      }
    })();
  }, [getIdToken]);

  const rawTab = params.get('tab') || 'plans';
  const tab =
    rawTab === 'history' || rawTab === 'all'
      ? 'history'
      : rawTab === 'pending' || rawTab === 'running' || rawTab === 'banners'
        ? 'banners'
        : ['plans', 'banners', 'history'].includes(rawTab)
          ? rawTab
          : 'plans';

  return (
    <PageContainer title={tab === 'banners' ? 'Duyệt banner' : tab === 'history' ? 'Lịch sử banner' : 'Gói banner'}>
      {tab === 'plans' ? <BannerPlansTab /> : null}
      {tab === 'banners' ? <BannerManageTab onMutate={handleBannerMutate} /> : null}
      {tab === 'history' ? <BannerHistoryTab onMutate={handleBannerMutate} /> : null}
    </PageContainer>
  );
}

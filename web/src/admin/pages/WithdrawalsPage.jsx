import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Descriptions, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';

import {
  approveAdminWithdraw,
  getAdminWithdraw,
  listAdminWithdraws,
  rejectAdminWithdraw,
} from '../../api/bankApi';
import PageContainer from '../components/PageContainer';
import ListToolbar from '../components/ListToolbar';
import StatCards from '../components/StatCards';
import ShopCell from '../components/ShopCell';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { useUrlQueryString } from '../hooks/useUrlQuery';
import { formatCurrency, formatDateTime } from '../utils/format';
import { withSttColumn } from '../utils/tableColumns';
import {
  ALL_FILTER_VALUE,
  apiFilterParam,
  initialFilterValue,
  withAllFilterOption,
} from '../utils/filterOptions';
import { useAuth } from '../../context/AuthContext';

const { Text } = Typography;

const STATUS = {
  0: { label: 'Chờ duyệt', color: 'orange' },
  1: { label: 'Đã duyệt', color: 'green' },
  2: { label: 'Từ chối', color: 'red' },
};

const STATUS_OPTIONS = withAllFilterOption([
  { value: '0', label: 'Chờ duyệt' },
  { value: '1', label: 'Đã duyệt' },
  { value: '2', label: 'Từ chối' },
]);

function SellerShopCell({ record, onOpenShop, onOpenUser }) {
  const shopId = record.shopId;
  const userId = record.userId;
  return (
    <ShopCell
      shopName={record.shopName || '—'}
      shopUsername={record.shopUsername}
      shopAvatar={record.shopAvatar}
      onClick={
        shopId
          ? () => onOpenShop(shopId)
          : userId
            ? () => onOpenUser(userId)
            : undefined
      }
    />
  );
}

export default function WithdrawalsPage() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const urlStatus = useUrlQueryString('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => initialFilterValue(urlStatus));
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('approve');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetcher = useCallback(
    async ({ page, limit }) => {
      const token = await getIdToken();
      const payload = await listAdminWithdraws(token, {
        page,
        limit,
        search,
        status: apiFilterParam(status),
      });
      return {
        data: {
          items: payload.data?.items || [],
          pagination: {
            page: payload.data?.page,
            limit: payload.data?.limit,
            total: payload.data?.total,
          },
          stats: payload.data?.stats,
        },
      };
    },
    [getIdToken, search, status]
  );

  const { items, loading, error, pagination, page, setPage, limit, stats, reload } = usePaginatedQuery({
    fetcher,
    deps: [search, status],
  });

  const statItems = useMemo(
    () => [
      { key: 'total', title: 'Tổng yêu cầu', value: stats?.total ?? 0 },
      { key: 'pending', title: 'Chờ duyệt', value: stats?.pending ?? 0 },
      { key: 'approved', title: 'Đã duyệt', value: stats?.approved ?? 0 },
      { key: 'rejected', title: 'Từ chối', value: stats?.rejected ?? 0 },
    ],
    [stats]
  );

  function openAction(record, action) {
    setSelected(record);
    setMode(action);
    setNote('');
    setNoteOpen(true);
  }

  async function openDetail(record) {
    setDetail(record);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const token = await getIdToken();
      const payload = await getAdminWithdraw(token, record.id || record._id);
      setDetail(payload.data?.withdraw || record);
    } catch (err) {
      message.error(err.message || 'Không tải được chi tiết');
    } finally {
      setDetailLoading(false);
    }
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
      if (detailOpen && detail && String(detail.id || detail._id) === String(id)) {
        await openDetail({ ...detail, id });
      }
      reload();
    } catch (err) {
      message.error(err.message || 'Thao tác thất bại');
    }
  }

  const detailStatus = detail ? STATUS[detail.status] : null;

  return (
    <PageContainer
      title="Rút tiền người bán"
      subtitle="Chỉ tài khoản người bán (role seller) được rút tiền về ngân hàng."
      stats={<StatCards items={statItems} loading={loading && !stats} columns={4} />}
    >
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
        searchPlaceholder="Tìm gian hàng (tên, @username)..."
        filters={[
          {
            key: 'status',
            placeholder: 'Trạng thái',
            value: status,
            onChange: (v) => {
              setStatus(v || ALL_FILTER_VALUE);
              setPage(1);
            },
            options: STATUS_OPTIONS,
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
        pagination={{ current: page, pageSize: limit, total: pagination.total, onChange: setPage }}
        columns={withSttColumn(
          [
            {
              title: 'Gian hàng',
              key: 'shop',
              render: (_, record) => (
                <SellerShopCell
                  record={record}
                  onOpenShop={(shopId) => navigate(`/sellers/shops/${shopId}`)}
                  onOpenUser={(userId) => navigate(`/users/${userId}`)}
                />
              ),
            },
            { title: 'Ngân hàng', dataIndex: 'bankName', render: (v, r) => v || r.bankCode || '—' },
            { title: 'STK nhận', dataIndex: 'accountNumber' },
            { title: 'Số tiền rút', dataIndex: 'amount', render: formatCurrency },
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
              render: (_, record) => (
                <Space wrap>
                  <Button size="small" onClick={() => openDetail(record)}>
                    Chi tiết
                  </Button>
                  {record.status === 0 ? (
                    <>
                      <Button size="small" type="primary" onClick={() => openAction(record, 'approve')}>
                        Duyệt
                      </Button>
                      <Button size="small" danger onClick={() => openAction(record, 'reject')}>
                        Từ chối
                      </Button>
                    </>
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
        centered
        title="Chi tiết rút tiền"
        onCancel={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        footer={
          detail?.status === 0 ? (
            <Space>
              <Button onClick={() => setDetailOpen(false)}>Đóng</Button>
              <Button danger onClick={() => openAction(detail, 'reject')}>
                Từ chối
              </Button>
              <Button type="primary" onClick={() => openAction(detail, 'approve')}>
                Duyệt
              </Button>
            </Space>
          ) : (
            <Button type="primary" onClick={() => setDetailOpen(false)}>
              Đóng
            </Button>
          )
        }
        width={640}
        destroyOnClose
      >
        {detailLoading && !detail ? (
          <p>Đang tải...</p>
        ) : detail ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <SellerShopCell
                record={detail}
                onOpenShop={(shopId) => {
                  setDetailOpen(false);
                  navigate(`/sellers/shops/${shopId}`);
                }}
                onOpenUser={(userId) => {
                  setDetailOpen(false);
                  navigate(`/users/${userId}`);
                }}
              />
              {detail.userPhone ? (
                <div style={{ marginTop: 8, color: 'rgba(0,0,0,0.65)' }}>SĐT: {detail.userPhone}</div>
              ) : null}
              {detail.userEmail ? (
                <div style={{ color: 'rgba(0,0,0,0.65)' }}>Email: {detail.userEmail}</div>
              ) : null}
            </div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Thông tin chuyển khoản
            </Text>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Mã phiếu">{detail.id || detail._id}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {detailStatus ? <Tag color={detailStatus.color}>{detailStatus.label}</Tag> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Số tiền rút">{formatCurrency(detail.amount)}</Descriptions.Item>
              <Descriptions.Item label="Ngân hàng">{detail.bankName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Mã ngân hàng">{detail.bankCode || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số tài khoản nhận">{detail.accountNumber || '—'}</Descriptions.Item>
              <Descriptions.Item label="Tên chủ TK (nhận tiền)">{detail.accountName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ghi chú admin">{detail.adminNote || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">{formatDateTime(detail.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Ngày xử lý">{formatDateTime(detail.tgXuLy) || '—'}</Descriptions.Item>
            </Descriptions>
          </>
        ) : null}
      </Modal>
      <Modal
        open={noteOpen}
        centered
        title={mode === 'approve' ? 'Duyệt rút tiền' : 'Từ chối rút tiền'}
        onCancel={() => setNoteOpen(false)}
        onOk={submitAction}
      >
        <Input.TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú / lý do" />
      </Modal>
    </PageContainer>
  );
}

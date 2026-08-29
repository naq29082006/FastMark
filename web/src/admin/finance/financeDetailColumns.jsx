import { Button, Tag } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

import ShopCell from '../components/ShopCell';
import PreviewableImage from '../../components/PreviewableImage';
import { formatCurrency, formatDateTime, formatPercent } from '../utils/format';

const DETAIL_TITLES = {
  allWallets: 'Danh sách ví',
  gmv: 'Đơn hàng hoàn thành (GMV)',
  escrow: 'Đơn đang giữ cọc',
  depositRelease: 'Giao dịch giải ngân cọc',
  disputed: 'Đơn tranh chấp',
  buyerWallets: 'Ví người mua',
  sellerWallets: 'Ví người bán',
  topup: 'Lịch sử nạp tiền',
  withdrawal: 'Lịch sử rút tiền',
  platformRevenue: 'Doanh thu gói Seller',
  bannerSales: 'Doanh thu Banner',
  depositHold: 'Giao dịch đặt cọc',
  depositRefund: 'Giao dịch hoàn cọc',
  pendingWithdraw: 'Phiếu rút chờ duyệt',
};

const WALLET_TX_STATUS_COLORS = {
  0: 'orange',
  1: 'green',
  2: 'red',
  3: 'default',
};

const WITHDRAW_STATUS_COLORS = {
  0: 'orange',
  1: 'green',
  2: 'red',
};

export function financeDetailTitle(detailType) {
  return DETAIL_TITLES[detailType] || 'Chi tiết';
}

function accountCell(record) {
  return (
    <ShopCell
      shopName={record.fullName || record.userName || '—'}
      shopUsername={record.userName}
      shopAvatar={record.avatar}
    />
  );
}

function productCell(name, thumbnail) {
  const label = name || '—';
  return (
    <div className="admin-dashboard-product-cell">
      <PreviewableImage
        src={thumbnail}
        alt={label}
        width={40}
        height={40}
        shape="rounded"
        fallbackLetter={label}
        className="admin-dashboard-product-cell-thumb"
      />
      <span className="admin-dashboard-product-cell-name" title={label}>
        {label}
      </span>
    </div>
  );
}

function viewUserAction(userId) {
  if (!userId) return null;
  return (
    <Link to={`/users/${userId}`}>
      <Button type="link" size="small" icon={<EyeOutlined />} aria-label="Xem tài khoản" />
    </Link>
  );
}

function walletColumns() {
  return [
    {
      title: 'Tài khoản',
      key: 'account',
      width: 260,
      render: (_, record) => accountCell(record),
    },
    {
      title: 'Vai trò',
      dataIndex: 'roleLabel',
      key: 'roleLabel',
      width: 120,
      render: (value) => value || '—',
    },
    {
      title: 'Thông tin liên hệ',
      key: 'contact',
      width: 240,
      render: (_, record) => (
        <div className="admin-finance-contact-cell">
          <div>{record.email || '—'}</div>
          <div style={{ color: 'rgba(0,0,0,0.55)' }}>{record.phone || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Số dư',
      dataIndex: 'balance',
      key: 'balance',
      width: 140,
      align: 'right',
      render: (value) => formatCurrency(value),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => viewUserAction(record.id),
    },
  ];
}

function topupColumns() {
  return [
    {
      title: 'Mã giao dịch',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 130,
      render: (value, record) => value || record.id?.slice(-8)?.toUpperCase() || '—',
    },
    {
      title: 'Tài khoản',
      key: 'account',
      width: 260,
      render: (_, record) => accountCell(record),
    },
    {
      title: 'Vai trò',
      dataIndex: 'roleLabel',
      key: 'roleLabel',
      width: 120,
      render: (value) => value || '—',
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      align: 'right',
      render: (value) => formatCurrency(value),
    },
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: formatDateTime,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'statusLabel',
      key: 'statusLabel',
      width: 130,
      render: (value, record) => (
        <Tag color={WALLET_TX_STATUS_COLORS[record.status] || 'default'}>{value || '—'}</Tag>
      ),
    },
  ];
}

function withdrawalColumns() {
  return [
    {
      title: 'Mã giao dịch',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 130,
      render: (value, record) =>
        value || record.withdrawId?.slice(-8)?.toUpperCase() || record.id?.slice(-8)?.toUpperCase() || '—',
    },
    {
      title: 'Tài khoản',
      key: 'account',
      width: 260,
      render: (_, record) => accountCell(record),
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      align: 'right',
      render: (value) => formatCurrency(value),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (value) => value || '—',
    },
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: formatDateTime,
    },
    {
      title: 'STK rút về',
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      width: 150,
      render: (value) => value || '—',
    },
    {
      title: 'Tên người rút (CCCD)',
      dataIndex: 'accountName',
      key: 'accountName',
      width: 180,
      render: (value) => value || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'statusLabel',
      key: 'statusLabel',
      width: 130,
      render: (value, record) => (
        <Tag color={WITHDRAW_STATUS_COLORS[record.status] || 'default'}>{value || '—'}</Tag>
      ),
    },
  ];
}

function escrowColumns() {
  return [
    {
      title: 'Mã đơn',
      key: 'orderId',
      width: 110,
      render: (_, record) =>
        record.id ? (
          <Link to={`/reservations/${record.id}`}>{String(record.id).slice(-8).toUpperCase()}</Link>
        ) : (
          '—'
        ),
    },
    {
      title: 'Sản phẩm',
      key: 'product',
      width: 240,
      render: (_, record) => productCell(record.productName, record.productThumbnail),
    },
    {
      title: 'Gian hàng',
      key: 'shop',
      width: 240,
      render: (_, record) => (
        <ShopCell
          shopName={record.shopName}
          shopUsername={record.shopUsername}
          shopAvatar={record.shopAvatar}
        />
      ),
    },
    {
      title: 'Người mua',
      key: 'buyer',
      width: 240,
      render: (_, record) => (
        <ShopCell
          shopName={record.buyerFullName || record.buyerName}
          shopUsername={record.buyerUserName}
          shopAvatar={record.buyerAvatar}
        />
      ),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'orderTotal',
      key: 'orderTotal',
      width: 130,
      align: 'right',
      render: (value) => formatCurrency(value),
    },
    {
      title: 'Đặt cọc',
      key: 'deposit',
      width: 150,
      align: 'right',
      render: (_, record) => (
        <span>
          {formatCurrency(record.depositAmount)}
          {record.depositPercent ? (
            <span style={{ color: 'rgba(0,0,0,0.55)' }}>
              {' '}
              ({formatPercent(record.depositPercent, 0)})
            </span>
          ) : null}
        </span>
      ),
    },
    {
      title: 'Ngày mua',
      dataIndex: 'purchaseDate',
      key: 'purchaseDate',
      width: 170,
      render: (value, record) => formatDateTime(value || record.createdAt),
    },
    {
      title: 'Ngày giải ngân',
      dataIndex: 'releaseDate',
      key: 'releaseDate',
      width: 170,
      render: formatDateTime,
    },
  ];
}

function txColumns() {
  return topupColumns();
}

export function buildFinanceDetailColumns(detailType) {
  switch (detailType) {
    case 'allWallets':
    case 'buyerWallets':
    case 'sellerWallets':
      return walletColumns();
    case 'topup':
      return topupColumns();
    case 'withdrawal':
      return withdrawalColumns();
    case 'escrow':
      return escrowColumns();
    case 'gmv':
    case 'disputed':
      return escrowColumns();
    case 'bannerSales':
      return [
        { title: 'Gói', dataIndex: 'planName', key: 'planName' },
        {
          title: 'Số tiền',
          dataIndex: 'amount',
          key: 'amount',
          align: 'right',
          render: (value) => formatCurrency(value),
        },
        {
          title: 'Trạng thái',
          dataIndex: 'statusLabel',
          key: 'statusLabel',
          render: (value) => <Tag>{value}</Tag>,
        },
        {
          title: 'Mua lúc',
          dataIndex: 'ngayMua',
          key: 'ngayMua',
          render: (value, record) => formatDateTime(value || record.createdAt),
        },
      ];
    case 'pendingWithdraw':
      return withdrawalColumns();
    case 'platformRevenue':
    case 'depositHold':
    case 'depositRefund':
    case 'depositRelease':
      return txColumns();
    default:
      return txColumns();
  }
}

export function walletTxTypeLabelSafe(row, detailType) {
  return row.typeLabel || detailType;
}

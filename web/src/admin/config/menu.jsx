import {
  BankOutlined,
  BellOutlined,
  DashboardOutlined,
  FolderOutlined,
  FundOutlined,
  GiftOutlined,
  MoneyCollectOutlined,
  PictureOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  StarOutlined,
  TagsOutlined,
  UserOutlined,
  WalletOutlined,
  WarningOutlined,
} from '@ant-design/icons';

/** Sidebar phẳng — 15 tab nghiệp vụ, không submenu. */
export const ADMIN_MENU = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: '/users', icon: <UserOutlined />, label: 'Người dùng' },
  { key: '/sellers', icon: <ShopOutlined />, label: 'Người bán' },
  { key: '/categories', icon: <FolderOutlined />, label: 'Danh mục' },
  { key: '/products', icon: <TagsOutlined />, label: 'Sản phẩm' },
  { key: '/reservations', icon: <ShoppingCartOutlined />, label: 'Đơn hàng' },
  { key: '/reviews', icon: <StarOutlined />, label: 'Đánh giá' },
  { key: '/disputes', icon: <WarningOutlined />, label: 'Khiếu nại' },
  { key: '/finance', icon: <FundOutlined />, label: 'Tài chính hệ thống' },
  { key: '/system-wallet', icon: <WalletOutlined />, label: 'Ví hệ thống' },
  { key: '/banks', icon: <BankOutlined />, label: 'Ngân hàng' },
  { key: '/withdrawals', icon: <MoneyCollectOutlined />, label: 'Rút tiền' },
  { key: '/seller-plans', icon: <GiftOutlined />, label: 'Gói dịch vụ' },
  { key: '/banner-plans', icon: <PictureOutlined />, label: 'Gói Banner' },
  { key: '/notifications', icon: <BellOutlined />, label: 'Thông báo' },
];

const MENU_ROUTE_ALIASES = {
  '/seller-subscriptions': '/seller-plans',
  '/seller-banners': '/banner-plans',
};

export function resolveMenuKey(pathname) {
  const normalized = MENU_ROUTE_ALIASES[pathname] || pathname;
  if (normalized === '/') return '/';
  const match = ADMIN_MENU.map((item) => item.key)
    .filter((key) => key !== '/')
    .sort((a, b) => b.length - a.length)
    .find((key) => normalized === key || normalized.startsWith(`${key}/`));
  return match || normalized;
}

export function resolvePageTitle(pathname) {
  const key = resolveMenuKey(pathname);
  const item = ADMIN_MENU.find((entry) => entry.key === key);
  return item?.label || 'FastMark Admin';
}

export function buildAdminMenuItems() {
  return ADMIN_MENU.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));
}

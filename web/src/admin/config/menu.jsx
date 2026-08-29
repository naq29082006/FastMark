import {
  BankOutlined,
  BellOutlined,
  FolderOutlined,
  FundOutlined,
  GiftOutlined,
  HomeOutlined,
  MoneyCollectOutlined,
  PictureOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  StarOutlined,
  TagsOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';

/** Mục menu phẳng (không submenu). */
const FLAT_MENU = [
  { key: '/', icon: <HomeOutlined />, label: 'Tổng quan' },
  { key: '/products', icon: <TagsOutlined />, label: 'Sản phẩm' },
  { key: '/reviews', icon: <StarOutlined />, label: 'Đánh giá' },
  { key: '/disputes', icon: <WarningOutlined />, label: 'Khiếu nại', countKey: 'reports' },
  { key: '/finance', icon: <FundOutlined />, label: 'Tài chính hệ thống' },
  { key: '/banks', icon: <BankOutlined />, label: 'Ngân hàng' },
  { key: '/withdrawals', icon: <MoneyCollectOutlined />, label: 'Rút tiền', countKey: 'withdrawCount' },
  { key: '/notifications', icon: <BellOutlined />, label: 'Thông báo' },
];

/** Nhóm menu accordion (submenu). */
const GROUP_MENU = [
  {
    key: 'group-accounts',
    icon: <UserOutlined />,
    label: 'Tài khoản',
    children: [
      { key: '/users', label: 'Người dùng' },
      { key: '/sellers', label: 'Người bán', countKey: 'sellerVerifications' },
    ],
  },
  {
    key: 'group-categories',
    icon: <FolderOutlined />,
    label: 'Danh mục',
    children: [
      { key: '/categories?type=products', label: 'Danh mục sản phẩm' },
      { key: '/categories?type=shops', label: 'Danh mục shop' },
    ],
  },
  {
    key: 'group-reservations',
    icon: <ShoppingCartOutlined />,
    label: 'Đơn hàng',
    children: [
      { key: '/reservations', label: 'Tất cả đơn hàng' },
      {
        key: '/reservations?tab=dispute_admin',
        label: 'Đơn hàng tranh chấp',
        countKey: 'disputeAdminQueue',
      },
    ],
  },
  {
    key: 'group-seller-plans',
    icon: <GiftOutlined />,
    label: 'Gói dịch vụ',
    children: [
      { key: '/seller-plans?tab=plans', label: 'Gói bán' },
      { key: '/seller-plans?tab=history', label: 'Lịch sử gói bán' },
    ],
  },
  {
    key: 'group-banner-plans',
    icon: <PictureOutlined />,
    label: 'Gói Banner',
    children: [
      { key: '/banner-plans?tab=plans', label: 'Gói banner' },
      { key: '/banner-plans?tab=banners', label: 'Duyệt banner', countKey: 'bannerPendingReview' },
    ],
  },
];

const MENU_ROUTE_ALIASES = {
  '/seller-subscriptions': '/seller-plans?tab=history',
  '/seller-banners': '/banner-plans?tab=banners',
};

const LEAF_ITEMS = [
  ...FLAT_MENU,
  ...GROUP_MENU.flatMap((group) => group.children.map((child) => ({ ...child, groupKey: group.key }))),
];

const LEAF_BY_KEY = new Map(LEAF_ITEMS.map((item) => [item.key, item]));

function parseMenuRoute(key) {
  const [pathname, query = ''] = String(key).split('?');
  const params = new URLSearchParams(query);
  return { pathname, params, search: query ? `?${query}` : '' };
}

function buildLocationKey(pathname, searchParams) {
  const path = MENU_ROUTE_ALIASES[pathname] || pathname;

  if (path.includes('?')) {
    return path;
  }

  if (path === '/') {
    return '/';
  }

  if (path === '/categories') {
    const type = searchParams.get('type') === 'products' ? 'products' : 'shops';
    return `/categories?type=${type}`;
  }

  if (path === '/seller-plans') {
    const tab = searchParams.get('tab') === 'history' ? 'history' : 'plans';
    return `/seller-plans?tab=${tab}`;
  }

  if (path === '/banner-plans') {
    const raw = searchParams.get('tab');
    if (raw === 'banners' || raw === 'pending' || raw === 'running') {
      return '/banner-plans?tab=banners';
    }
    if (raw === 'history') {
      return '/banner-plans?tab=history';
    }
    return '/banner-plans?tab=plans';
  }

  if (path.startsWith('/users')) {
    return '/users';
  }
  if (path.startsWith('/sellers')) {
    return '/sellers';
  }

  if (path === '/reservations' || path.startsWith('/reservations/')) {
    const tab = searchParams.get('tab');
    if (tab === 'dispute_admin') {
      return '/reservations?tab=dispute_admin';
    }
    return '/reservations';
  }

  const flat = FLAT_MENU.find((item) => path === item.key || path.startsWith(`${item.key}/`));
  return flat?.key || path;
}

export function resolveMenuKey(pathname, searchParams = new URLSearchParams()) {
  return buildLocationKey(pathname, searchParams);
}

export function resolveOpenMenuKeys(pathname, searchParams = new URLSearchParams()) {
  const selected = resolveMenuKey(pathname, searchParams);
  const leaf = LEAF_BY_KEY.get(selected);
  return leaf?.groupKey ? [leaf.groupKey] : [];
}

export function resolvePageTitle(pathname, searchParams = new URLSearchParams()) {
  const key = resolveMenuKey(pathname, searchParams);
  const leaf = LEAF_BY_KEY.get(key);
  if (leaf?.label) {
    return leaf.label;
  }
  const flat = FLAT_MENU.find((item) => item.key === key);
  return flat?.label || 'FastMark Admin';
}

function withCountLabel(label, count) {
  if (!count) {
    return label;
  }
  return (
    <span className="admin-sidebar-menu-label">
      <span className="admin-sidebar-menu-text">{label}</span>
      <span className="admin-sidebar-menu-count">{String(count)}</span>
    </span>
  );
}

function resolveLeafLabel(item, pendingCounts) {
  const count = item.countKey
    ? Math.max(0, Number(pendingCounts[item.countKey]) || 0)
    : 0;
  return withCountLabel(item.label, count);
}

export function buildAdminMenuItems(pendingCounts = {}) {
  const flatItems = FLAT_MENU.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: resolveLeafLabel(item, pendingCounts),
  }));

  const groupItems = GROUP_MENU.map((group) => ({
    key: group.key,
    icon: group.icon,
    label: group.label,
    children: group.children.map((child) => ({
      key: child.key,
      label: resolveLeafLabel(child, pendingCounts),
    })),
  }));

  return [
    flatItems[0],
    groupItems[0],
    groupItems[1],
    flatItems[1],
    groupItems[2],
    flatItems[2],
    flatItems[3],
    flatItems[4],
    flatItems[5],
    flatItems[6],
    flatItems[7],
    groupItems[3],
    groupItems[4],
    flatItems[8],
  ];
}

export function navigateMenuKey(navigate, key) {
  const { pathname, search } = parseMenuRoute(key);
  navigate({ pathname, search: search || undefined });
}

import { createElement } from 'react';
import {
  AppstoreOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  FileTextOutlined,
  GiftOutlined,
  InboxOutlined,
  LockOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  StopOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
  WarningOutlined,
} from '@ant-design/icons';

/** Icon + tone theo tiêu đề (ưu tiên — cùng key có thể khác ngữ cảnh). */
const TITLE_PRESETS = {
  'Tổng đơn': { icon: ShoppingCartOutlined, tone: 'blue' },
  'Tổng tài khoản': { icon: TeamOutlined, tone: 'blue' },
  'Tổng hồ sơ': { icon: FileTextOutlined, tone: 'blue' },
  'Tổng sản phẩm': { icon: AppstoreOutlined, tone: 'purple' },
  'Tổng yêu cầu': { icon: FileTextOutlined, tone: 'blue' },
  'Tổng lượt đăng ký': { icon: GiftOutlined, tone: 'purple' },
  'Tổng ví người mua': { icon: WalletOutlined, tone: 'blue' },
  'Tổng ví người bán': { icon: WalletOutlined, tone: 'purple' },
  'Tổng số dư': { icon: DollarOutlined, tone: 'teal' },
  'Số dư ví hệ thống': { icon: BankOutlined, tone: 'teal' },
  'Chờ xác nhận': { icon: ClockCircleOutlined, tone: 'amber' },
  'Chờ duyệt': { icon: ClockCircleOutlined, tone: 'amber' },
  'Chờ xử lý': { icon: ClockCircleOutlined, tone: 'amber' },
  'Giữ hàng': { icon: InboxOutlined, tone: 'purple' },
  'Đã nhận hàng': { icon: InboxOutlined, tone: 'blue' },
  'Hoàn thành': { icon: CheckCircleOutlined, tone: 'green' },
  'Tranh chấp': { icon: WarningOutlined, tone: 'orange' },
  'Tranh chấp đã xử lý': { icon: CheckCircleOutlined, tone: 'green' },
  'Đã hủy': { icon: CloseCircleOutlined, tone: 'red' },
  'Người mua': { icon: UserOutlined, tone: 'blue' },
  'Người bán': { icon: ShopOutlined, tone: 'green' },
  'Đang hoạt động': { icon: CheckCircleOutlined, tone: 'green' },
  'Đã khóa': { icon: StopOutlined, tone: 'red' },
  'Gian hàng đã khóa': { icon: LockOutlined, tone: 'red' },
  'Đã duyệt': { icon: CheckCircleOutlined, tone: 'green' },
  'Từ chối': { icon: CloseCircleOutlined, tone: 'red' },
  'Đã xử lý': { icon: CheckCircleOutlined, tone: 'green' },
  'Đã bác bỏ': { icon: CloseCircleOutlined, tone: 'red' },
  'Đang hiện': { icon: EyeOutlined, tone: 'green' },
  'Đã ẩn': { icon: EyeInvisibleOutlined, tone: 'amber' },
  'Đã xóa': { icon: DeleteOutlined, tone: 'red' },
  'Hiển thị': { icon: EyeOutlined, tone: 'green' },
  'Tổng': { icon: FileTextOutlined, tone: 'blue' },
  'Gian hàng': { icon: ShopOutlined, tone: 'green' },
  'Sản phẩm': { icon: AppstoreOutlined, tone: 'purple' },
  'Tổng đơn hàng': { icon: ShoppingCartOutlined, tone: 'amber' },
  'Doanh thu tích lũy': { icon: DollarOutlined, tone: 'teal' },
  'Shop đã mua gói': { icon: ShopOutlined, tone: 'green' },
  'Shop đã mua banner': { icon: ShopOutlined, tone: 'green' },
  'Đang hiệu lực': { icon: CheckCircleOutlined, tone: 'green' },
  'Đang chạy': { icon: PlayCircleOutlined, tone: 'green' },
  'Hết hạn': { icon: CloseCircleOutlined, tone: 'red' },
  'Chưa treo': { icon: PictureOutlined, tone: 'slate' },
  'Đang treo': { icon: PictureOutlined, tone: 'blue' },
  'Đơn escrow đang treo': { icon: LockOutlined, tone: 'orange' },
  'Tất cả giao dịch': { icon: WalletOutlined, tone: 'blue' },
  'Khiếu nại': { icon: WarningOutlined, tone: 'orange' },
  'Doanh thu (30 ngày)': { icon: DollarOutlined, tone: 'teal' },
  'Ví hệ thống': { icon: BankOutlined, tone: 'teal' },
};

/** Icon + tone theo key (fallback). */
const KEY_PRESETS = {
  total: { icon: ShoppingCartOutlined, tone: 'blue' },
  pending: { icon: ClockCircleOutlined, tone: 'amber' },
  holding: { icon: InboxOutlined, tone: 'purple' },
  received: { icon: InboxOutlined, tone: 'blue' },
  completed: { icon: CheckCircleOutlined, tone: 'green' },
  disputed: { icon: WarningOutlined, tone: 'orange' },
  disputeResolved: { icon: CheckCircleOutlined, tone: 'green' },
  cancelled: { icon: CloseCircleOutlined, tone: 'red' },
  buyers: { icon: UserOutlined, tone: 'blue' },
  sellers: { icon: ShopOutlined, tone: 'green' },
  active: { icon: CheckCircleOutlined, tone: 'green' },
  blocked: { icon: StopOutlined, tone: 'red' },
  approved: { icon: CheckCircleOutlined, tone: 'green' },
  rejected: { icon: CloseCircleOutlined, tone: 'red' },
  processed: { icon: CheckCircleOutlined, tone: 'green' },
  visible: { icon: EyeOutlined, tone: 'green' },
  hidden: { icon: EyeInvisibleOutlined, tone: 'amber' },
  removed: { icon: DeleteOutlined, tone: 'red' },
  deleted: { icon: DeleteOutlined, tone: 'red' },
  users: { icon: TeamOutlined, tone: 'blue' },
  shops: { icon: ShopOutlined, tone: 'green' },
  products: { icon: AppstoreOutlined, tone: 'purple' },
  reservations: { icon: ShoppingCartOutlined, tone: 'amber' },
  revenue: { icon: DollarOutlined, tone: 'teal' },
  running: { icon: PlayCircleOutlined, tone: 'green' },
  expired: { icon: CloseCircleOutlined, tone: 'red' },
  purchased: { icon: PictureOutlined, tone: 'slate' },
  disputes: { icon: WarningOutlined, tone: 'orange' },
  wallet: { icon: WalletOutlined, tone: 'teal' },
  buyerTotal: { icon: WalletOutlined, tone: 'blue' },
  sellerTotal: { icon: WalletOutlined, tone: 'purple' },
  all: { icon: DollarOutlined, tone: 'teal' },
  systemWallet: { icon: BankOutlined, tone: 'teal' },
  buyerWallets: { icon: WalletOutlined, tone: 'blue' },
  sellerWallets: { icon: WalletOutlined, tone: 'purple' },
  escrowOrders: { icon: LockOutlined, tone: 'orange' },
};

function renderPresetIcon(IconComponent) {
  return IconComponent ? createElement(IconComponent) : null;
}

export function enrichStatItems(items = []) {
  return items.map((item) => {
    if (item.icon) {
      return item;
    }
    const byTitle = item.title ? TITLE_PRESETS[item.title] : null;
    const byKey = item.key ? KEY_PRESETS[item.key] : null;
    const preset = byTitle || byKey;
    if (!preset) {
      return item;
    }
    return {
      ...item,
      icon: renderPresetIcon(preset.icon),
      tone: item.tone || preset.tone || 'slate',
    };
  });
}

/** All backend domain constants in one place. */

// ── Roles & verification ─────────────────────────────────────────────
const SELLER_VERIFICATION_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

const USER_ROLE = {
  BUYER: 1,
  SELLER: 2,
  ADMIN: 3,
};

const USER_STATUS = {
  BLOCKED: 0,
  ACTIVE: 1,
};

/** Catalog soft-delete / visibility: 1 = đang dùng, 0 = xóa mềm. */
const RECORD_STATUS = {
  HIDDEN: 0,
  ACTIVE: 1,
};

function isRecordActive(value) {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  return Number(value) === RECORD_STATUS.ACTIVE;
}

/** Mongo filter — hỗ trợ data cũ boolean true/false và string "1"/"0". */
function activeRecordFilter(field = "isActive") {
  const activeValues = [RECORD_STATUS.ACTIVE, true, "1"];
  return {
    $or: [
      { $expr: { $in: [`$${field}`, activeValues] } },
      { [field]: { $exists: false } },
    ],
  };
}

// ── Shop & product ───────────────────────────────────────────────────
const SHOP_STATUS = {
  BLOCKED: 0,
  ACTIVE: 1,
};

const SHOP_OPEN = {
  CLOSED: 0,
  OPEN: 1,
};

const PRODUCT_STATUS = {
  HIDDEN: 0,
  ACTIVE: 1,
};

const PRODUCT_REMOVED_BY = {
  ADMIN: "admin",
  SELLER: "seller",
};

const REVIEW_REMOVED_BY = {
  ADMIN: "admin",
  BUYER: "buyer",
};

// ── Reservations ─────────────────────────────────────────────────────
/**
 * Reservation status:
 * 0 Pending | 1 Confirmed | 2 WaitingPickup | 3 Received
 * 4 Disputed | 5 Completed | 6 Cancelled
 */
const RESERVATION_STATUS = {
  PENDING: 0,
  CONFIRMED: 1,
  WAITING_PICKUP: 2,
  RECEIVED: 3,
  DISPUTED: 4,
  COMPLETED: 5,
  CANCELLED: 6,
  /** @deprecated */ PENDING_SELLER_CONFIRMATION: 0,
  /** @deprecated */ REJECTED: 6,
  /** @deprecated */ DELIVERED_PENDING_DISPUTE: 3,
  /** @deprecated */ AUTO_COMPLETED: 5,
  /** @deprecated */ REFUNDED: 6,
  /** @deprecated */ DISPUTE_RESOLVED: 6,
  /** @deprecated */ ACCEPTED: 2,
  /** @deprecated */ READY: 2,
};

const RESERVATION_STATUS_LABEL = {
  [RESERVATION_STATUS.PENDING]: "Chờ xác nhận",
  [RESERVATION_STATUS.CONFIRMED]: "Giữ hàng",
  [RESERVATION_STATUS.WAITING_PICKUP]: "Giữ hàng",
  [RESERVATION_STATUS.RECEIVED]: "Hoàn thành",
  [RESERVATION_STATUS.DISPUTED]: "Tranh chấp",
  [RESERVATION_STATUS.COMPLETED]: "Hoàn thành",
  [RESERVATION_STATUS.CANCELLED]: "Đã hủy",
};

const DISPUTE_CREATED_BY = {
  BUYER: 1,
  SELLER: 2,
};

const DISPUTE_REASON_TYPE = {
  SHOP_NOT_FOUND: 1,
  SHOP_CLOSED: 2,
  OUT_OF_STOCK: 3,
  WRONG_PRODUCT: 4,
  DAMAGED_PRODUCT: 5,
  BUYER_NO_SHOW: 6,
  OTHER: 99,
};

const DISPUTE_REASON_TYPE_LABEL = {
  [DISPUTE_REASON_TYPE.SHOP_NOT_FOUND]: "Không tìm thấy người bán",
  [DISPUTE_REASON_TYPE.SHOP_CLOSED]: "Cửa hàng đóng cửa",
  [DISPUTE_REASON_TYPE.OUT_OF_STOCK]: "Hết hàng",
  [DISPUTE_REASON_TYPE.WRONG_PRODUCT]: "Sai sản phẩm",
  [DISPUTE_REASON_TYPE.DAMAGED_PRODUCT]: "Hàng lỗi",
  [DISPUTE_REASON_TYPE.BUYER_NO_SHOW]: "Người mua không tới",
  [DISPUTE_REASON_TYPE.OTHER]: "Khác",
};

const DISPUTE_STATUS = {
  PENDING: 0,
  ACCEPT_BUYER: 1,
  ACCEPT_SELLER: 2,
  REJECTED: 3,
  CLOSED: 4,
};

const DISPUTE_STATUS_LABEL = {
  [DISPUTE_STATUS.PENDING]: "Chờ admin xử lý",
  [DISPUTE_STATUS.ACCEPT_BUYER]: "Chấp nhận người mua",
  [DISPUTE_STATUS.ACCEPT_SELLER]: "Chấp nhận người bán",
  [DISPUTE_STATUS.REJECTED]: "Từ chối khiếu nại",
  [DISPUTE_STATUS.CLOSED]: "Đóng khiếu nại",
};

const PAYMENT_STATUS = {
  ESCROW: 0,
  RELEASED: 1,
  REFUNDED: 2,
};

const DEFAULT_ESCROW_PROTECTION_DAYS = 7;
/** Số ngày seller được phản hồi khiếu nại sau giao hàng. */
const DEFAULT_SELLER_RESPONSE_DAYS = 2;
const ESCROW_PROTECTION_DAYS_MIN = 1;
const ESCROW_PROTECTION_DAYS_MAX = 30;
const ESCROW_PROTECTION_DAYS = DEFAULT_ESCROW_PROTECTION_DAYS;
const ESCROW_PROTECTION_MS = DEFAULT_ESCROW_PROTECTION_DAYS * 24 * 60 * 60 * 1000;

/** Giờ sau pickupTime được báo cáo trước khi auto-release cọc cho seller. */
const RESERVATION_DISPUTE_WINDOW_HOURS = 24;

/** Số ảnh chứng cứ tối đa mỗi báo cáo giữ hàng. */
const MAX_RESERVATION_REPORT_IMAGES = 5;

const RESERVATION_DISPUTE_REASON = {
  SELLER_ABSENT: "seller_absent",
  SHOP_CLOSED: "shop_closed",
  SELLER_NO_DELIVERY: "seller_no_delivery",
  SHOP_NO_DELIVERY: "shop_no_delivery",
  SHOP_OUT_OF_STOCK: "shop_out_of_stock",
  OTHER: "other",
  BUYER_NO_SHOW: "buyer_no_show",
  DAMAGED_ITEM: "damaged_item",
  MISSING_ITEM: "missing_item",
  WRONG_ITEM: "wrong_item",
  NOT_AS_DESCRIBED: "not_as_described",
  EXPIRED: "expired",
};

const RESERVATION_DISPUTE_REASON_LABEL = {
  [RESERVATION_DISPUTE_REASON.SELLER_ABSENT]: "Người bán không có mặt",
  [RESERVATION_DISPUTE_REASON.SHOP_CLOSED]: "Shop đóng cửa",
  [RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY]: "Người bán không giao hàng",
  [RESERVATION_DISPUTE_REASON.SHOP_NO_DELIVERY]: "Người bán không giao hàng",
  [RESERVATION_DISPUTE_REASON.SHOP_OUT_OF_STOCK]: "Shop hết hàng",
  [RESERVATION_DISPUTE_REASON.OTHER]: "Khác",
  [RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW]: "Người mua không đến nhận hàng",
  [RESERVATION_DISPUTE_REASON.DAMAGED_ITEM]: "Hàng bị hư hỏng",
  [RESERVATION_DISPUTE_REASON.MISSING_ITEM]: "Thiếu hàng",
  [RESERVATION_DISPUTE_REASON.WRONG_ITEM]: "Giao sai hàng",
  [RESERVATION_DISPUTE_REASON.NOT_AS_DESCRIBED]: "Không đúng mô tả",
  [RESERVATION_DISPUTE_REASON.EXPIRED]: "Hết hạn",
};

/** Khiếu nại pickup-time (trước/sau giờ nhận — Report legacy). */
const BUYER_DISPUTE_REASON_OPTIONS = [
  RESERVATION_DISPUTE_REASON.SELLER_ABSENT,
  RESERVATION_DISPUTE_REASON.SHOP_CLOSED,
  RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY,
  RESERVATION_DISPUTE_REASON.OTHER,
];

/** Khiếu nại sau khi seller xác nhận giao (escrow). */
const BUYER_COMPLAINT_REASON_OPTIONS = [
  RESERVATION_DISPUTE_REASON.DAMAGED_ITEM,
  RESERVATION_DISPUTE_REASON.MISSING_ITEM,
  RESERVATION_DISPUTE_REASON.WRONG_ITEM,
  RESERVATION_DISPUTE_REASON.NOT_AS_DESCRIBED,
  RESERVATION_DISPUTE_REASON.EXPIRED,
  RESERVATION_DISPUTE_REASON.OTHER,
];

const RESERVATION_DISPUTE_STATUS = {
  PENDING: DISPUTE_STATUS.PENDING,
  REVIEWING: DISPUTE_STATUS.PENDING,
  BUYER_WIN: DISPUTE_STATUS.ACCEPT_BUYER,
  SELLER_WIN: DISPUTE_STATUS.ACCEPT_SELLER,
};

/** @deprecated Dùng DISPUTE_STATUS.ACCEPT_BUYER / ACCEPT_SELLER */
const RESERVATION_DISPUTE_WINNER = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

const MAX_RESERVATION_DISPUTE_VIDEOS = 3;

function normalizeBuyerDisputeReason(reason) {
  const raw = String(reason || "").trim();
  if (raw === RESERVATION_DISPUTE_REASON.SHOP_NO_DELIVERY) {
    return RESERVATION_DISPUTE_REASON.SELLER_NO_DELIVERY;
  }
  if (
    BUYER_DISPUTE_REASON_OPTIONS.includes(raw) ||
    BUYER_COMPLAINT_REASON_OPTIONS.includes(raw)
  ) {
    return raw;
  }
  return "";
}

const RESERVATION_AUDIT_ACTION = {
  ADMIN_REFUND_BUYER: "ADMIN_REFUND_BUYER",
  ADMIN_RELEASE_SELLER: "ADMIN_RELEASE_SELLER",
};

// ── Reports ──────────────────────────────────────────────────────────
/**
 * Loại báo cáo (Report collection) — mã tuần tự 1–7:
 * 1 đánh giá | 2 gian hàng | 3 sản phẩm | 4 hệ thống | 5 khác
 * 6 khiếu nại khóa tài khoản | 7 khiếu nại khóa gian hàng
 *
 * Tranh chấp giữ hàng dùng ReservationDispute (không lưu Report).
 * DISPUTE_VIRTUAL_REPORT_TYPE (5–7) chỉ dùng hiển thị API dispute legacy.
 */
const REPORT_TYPE = {
  REVIEW: 1,
  SHOP: 2,
  PRODUCT: 3,
  SYSTEM: 4,
  OTHER: 5,
  ACCOUNT_LOCK_APPEAL: 6,
  SHOP_LOCK_APPEAL: 7,
};

/** Chỉ hiển thị complaint giữ hàng qua API dispute — không ghi Report. */
const DISPUTE_VIRTUAL_REPORT_TYPE = {
  BUYER_NO_SHOW: 5,
  SELLER_NO_SHOW: 6,
  PRODUCT_ISSUE: 7,
};

const REPORT_TYPE_LABELS = {
  [REPORT_TYPE.REVIEW]: "Đánh giá",
  [REPORT_TYPE.SHOP]: "Gian hàng",
  [REPORT_TYPE.PRODUCT]: "Sản phẩm",
  [REPORT_TYPE.SYSTEM]: "Hệ thống lỗi",
  [REPORT_TYPE.OTHER]: "Khác",
  [REPORT_TYPE.ACCOUNT_LOCK_APPEAL]: "Khiếu nại khóa tài khoản",
  [REPORT_TYPE.SHOP_LOCK_APPEAL]: "Khiếu nại khóa gian hàng",
  [DISPUTE_VIRTUAL_REPORT_TYPE.BUYER_NO_SHOW]: "Buyer không đến nhận",
  [DISPUTE_VIRTUAL_REPORT_TYPE.SELLER_NO_SHOW]: "Seller không bán / không mở cửa",
  [DISPUTE_VIRTUAL_REPORT_TYPE.PRODUCT_ISSUE]: "Sự cố sản phẩm (giữ hàng)",
};

/** Nhãn mã cũ trước khi migrate reportType. */
const LEGACY_REPORT_TYPE_LABELS = {
  2: "Người dùng",
  3: "Gian hàng",
  4: "Sản phẩm",
  8: "Hệ thống lỗi",
  9: "Khác",
  10: "Khiếu nại khóa tài khoản",
  11: "Khiếu nại khóa gian hàng",
};

/** Báo cáo nội dung (admin tab Báo cáo). */
const CONTENT_REPORT_TYPES = [
  REPORT_TYPE.REVIEW,
  REPORT_TYPE.SHOP,
  REPORT_TYPE.PRODUCT,
  REPORT_TYPE.SYSTEM,
  REPORT_TYPE.OTHER,
  REPORT_TYPE.ACCOUNT_LOCK_APPEAL,
  REPORT_TYPE.SHOP_LOCK_APPEAL,
];

/** Loại tố cáo từ màn Tài khoản (combobox). */
const ACCOUNT_REPORT_TYPES = [
  REPORT_TYPE.SYSTEM,
  REPORT_TYPE.OTHER,
];

const MAX_ACCOUNT_REPORT_IMAGES = 5;

/** Số ảnh chứng minh tối đa khi seller hủy đơn sau xác nhận. */
const MAX_SELLER_CANCEL_IMAGES = 5;

const REPORT_STATUS = {
  PENDING: 0,
  PROCESSED: 1,
  /** Alias nghiệp vụ = PROCESSED. */
  APPROVED: 1,
  REJECTED: 2,
};

const REPORT_STATUS_LABELS = {
  [REPORT_STATUS.PENDING]: "Chờ xử lý",
  [REPORT_STATUS.PROCESSED]: "Đã xử lý",
  [REPORT_STATUS.REJECTED]: "Đã bác bỏ",
};

/** Vai trò người gửi báo cáo tranh chấp giữ hàng. */
const REPORT_REPORTER_ROLE = {
  BUYER: 1,
  SELLER: 2,
};

const REPORT_REPORTER_ROLE_LABELS = {
  [REPORT_REPORTER_ROLE.BUYER]: "Người mua",
  [REPORT_REPORTER_ROLE.SELLER]: "Người bán",
};

// ── Notifications ────────────────────────────────────────────────────
const NOTIFICATION_AUDIENCE = {
  BUYER: "buyer",
  SELLER: "seller",
  /** Hiện ở cả chế độ buyer và seller (thông báo hệ thống/tài khoản). */
  SYSTEM: "system",
};

function normalizeNotificationAudience(value, fallback = NOTIFICATION_AUDIENCE.SYSTEM) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (Object.values(NOTIFICATION_AUDIENCE).includes(raw)) {
    return raw;
  }
  return fallback;
}

/** 1 = đơn hàng, 2 = hệ thống (tab lọc thông báo). */
const NOTIFICATION_INDEX = {
  ORDER: 1,
  SYSTEM: 2,
};

function normalizeNotificationIndex(value, fallback = NOTIFICATION_INDEX.SYSTEM) {
  const parsed = Number(value);
  if (parsed === NOTIFICATION_INDEX.ORDER) {
    return NOTIFICATION_INDEX.ORDER;
  }
  if (parsed === NOTIFICATION_INDEX.SYSTEM) {
    return NOTIFICATION_INDEX.SYSTEM;
  }
  return fallback;
}

// ── Banner (SellerBannerPlan creative) ───────────────────────────────
const BANNER_TARGET_TYPE = {
  PRODUCT: 1,
  SHOP: 2,
};

const BANNER_TARGET_TYPE_LABEL = {
  [BANNER_TARGET_TYPE.PRODUCT]: "Sản phẩm",
  [BANNER_TARGET_TYPE.SHOP]: "Gian hàng",
};

/**
 * Luồng: mua gói (PURCHASED) → gửi yêu cầu treo (PENDING_REVIEW)
 * → admin duyệt (ACTIVE, set start/end) hoặc từ chối + hoàn tiền (REJECTED).
 */
const SELLER_BANNER_STATUS = {
  PURCHASED: 0,
  ACTIVE: 1,
  CANCELLED: 2,
  REJECTED: 3,
  PENDING_REVIEW: 4,
};

const SELLER_BANNER_STATUS_LABEL = {
  [SELLER_BANNER_STATUS.PURCHASED]: "Chưa yêu cầu treo",
  [SELLER_BANNER_STATUS.PENDING_REVIEW]: "Chờ duyệt treo",
  [SELLER_BANNER_STATUS.ACTIVE]: "Đang treo",
  [SELLER_BANNER_STATUS.CANCELLED]: "Đã hủy / gỡ",
  [SELLER_BANNER_STATUS.REJECTED]: "Bị từ chối — có thể sửa gửi lại",
};

// ── Wallet ───────────────────────────────────────────────────────────
const WALLET_TX_TYPE = {
  TOPUP: 1,
  PAYMENT: 2,
  REFUND: 3,
  WITHDRAWAL: 4,
  // Buyer → System Wallet (đặt cọc giữ hàng).
  DEPOSIT_HOLD: 5,
  // System → Buyer (hoàn cọc).
  DEPOSIT_REFUND: 6,
  // System → Seller (giải phóng cọc).
  DEPOSIT_RELEASE: 7,
};

/** Kết thúc cọc trên Reservation: 0 chưa settle, 1 hoàn buyer, 2 giải ngân seller. */
const DEPOSIT_SETTLE_TO = {
  NONE: 0,
  BUYER: 1,
  SELLER: 2,
};

const DEPOSIT_SETTLE_TO_LABEL = {
  [DEPOSIT_SETTLE_TO.NONE]: "Đang giữ (escrow)",
  [DEPOSIT_SETTLE_TO.BUYER]: "Hoàn cho người mua",
  [DEPOSIT_SETTLE_TO.SELLER]: "Giải ngân cho người bán",
};

const WALLET_TX_STATUS = {
  PENDING: 0,
  SUCCESS: 1,
  FAILED: 2,
  CANCELLED: 3,
};

const WALLET_TX_STATUS_LABEL = {
  [WALLET_TX_STATUS.PENDING]: "Đang chờ",
  [WALLET_TX_STATUS.SUCCESS]: "Thành công",
  [WALLET_TX_STATUS.FAILED]: "Thất bại",
  [WALLET_TX_STATUS.CANCELLED]: "Đã hủy",
};

const WALLET_TX_TYPE_LABEL = {
  [WALLET_TX_TYPE.TOPUP]: "Nạp tiền",
  [WALLET_TX_TYPE.PAYMENT]: "Thanh toán",
  [WALLET_TX_TYPE.REFUND]: "Hoàn tiền",
  [WALLET_TX_TYPE.WITHDRAWAL]: "Rút tiền",
  [WALLET_TX_TYPE.DEPOSIT_HOLD]: "Đặt cọc giữ hàng",
  [WALLET_TX_TYPE.DEPOSIT_REFUND]: "Hoàn cọc giữ hàng",
  [WALLET_TX_TYPE.DEPOSIT_RELEASE]: "Giải phóng cọc cho shop",
};

/** Loại tham chiếu giao dịch ví (WalletTransaction.referenceType). */
const WALLET_REFERENCE_TYPE = {
  RESERVATION: "Reservation",
  REPORT: "Report",
  WITHDRAW: "WithdrawRequest",
  TOPUP: "Topup",
};

const MIN_TOPUP_AMOUNT = 10000;
const MAX_TOPUP_AMOUNT = 20000000;
const MIN_WITHDRAW_AMOUNT = 50000;
const MAX_WITHDRAW_AMOUNT = 20000000;

const WITHDRAW_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

const WITHDRAW_STATUS_LABEL = {
  [WITHDRAW_STATUS.PENDING]: "Chờ duyệt",
  [WITHDRAW_STATUS.APPROVED]: "Đã duyệt",
  [WITHDRAW_STATUS.REJECTED]: "Từ chối",
};

// ── Seller subscription plans ────────────────────────────────────────
const SELLER_SUBSCRIPTION_STATUS = {
  PENDING_PAYMENT: 0,
  ACTIVE: 1,
  EXPIRED: 2,
  CANCELLED: 3,
};

const SELLER_SUBSCRIPTION_STATUS_LABEL = {
  [SELLER_SUBSCRIPTION_STATUS.PENDING_PAYMENT]: "Chờ thanh toán",
  [SELLER_SUBSCRIPTION_STATUS.ACTIVE]: "Đang hiệu lực",
  [SELLER_SUBSCRIPTION_STATUS.EXPIRED]: "Hết hạn",
  [SELLER_SUBSCRIPTION_STATUS.CANCELLED]: "Đã hủy",
};

/**
 * Shop có gói còn hiệu lực — dựa ShopProfile.isActive (cache từ SellerSubscription).
 */
function isSubscriptionActive(shop) {
  if (!shop) {
    return false;
  }
  const value = shop.isActive;
  return value === true || value === 1 || value === "1";
}

/** Mongo filter — DB có cả boolean lẫn number 1. */
function activeSubscriptionFilter() {
  return {
    $expr: {
      $in: ["$isActive", [1, true]],
    },
  };
}

const reservationOrderFlow = require("./reservationOrderFlow");

module.exports = {
  SELLER_VERIFICATION_STATUS,
  USER_ROLE,
  USER_STATUS,
  RECORD_STATUS,
  isRecordActive,
  activeRecordFilter,
  SHOP_STATUS,
  SHOP_OPEN,
  PRODUCT_STATUS,
  PRODUCT_REMOVED_BY,
  REVIEW_REMOVED_BY,
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABEL,
  DISPUTE_CREATED_BY,
  DISPUTE_REASON_TYPE,
  DISPUTE_REASON_TYPE_LABEL,
  DISPUTE_STATUS,
  DISPUTE_STATUS_LABEL,
  PAYMENT_STATUS,
  DEFAULT_ESCROW_PROTECTION_DAYS,
  DEFAULT_SELLER_RESPONSE_DAYS,
  ESCROW_PROTECTION_DAYS_MIN,
  ESCROW_PROTECTION_DAYS_MAX,
  ESCROW_PROTECTION_DAYS,
  ESCROW_PROTECTION_MS,
  RESERVATION_DISPUTE_WINDOW_HOURS,
  BUYER_COMPLAINT_REASON_OPTIONS,
  RESERVATION_DISPUTE_STATUS,
  RESERVATION_DISPUTE_WINNER,
  MAX_RESERVATION_DISPUTE_VIDEOS,
  MAX_RESERVATION_REPORT_IMAGES,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABEL,
  BUYER_DISPUTE_REASON_OPTIONS,
  normalizeBuyerDisputeReason,
  RESERVATION_AUDIT_ACTION,
  REPORT_TYPE,
  DISPUTE_VIRTUAL_REPORT_TYPE,
  REPORT_TYPE_LABELS,
  LEGACY_REPORT_TYPE_LABELS,
  CONTENT_REPORT_TYPES,
  ACCOUNT_REPORT_TYPES,
  MAX_ACCOUNT_REPORT_IMAGES,
  MAX_SELLER_CANCEL_IMAGES,
  REPORT_STATUS,
  REPORT_STATUS_LABELS,
  REPORT_REPORTER_ROLE,
  REPORT_REPORTER_ROLE_LABELS,
  NOTIFICATION_AUDIENCE,
  normalizeNotificationAudience,
  NOTIFICATION_INDEX,
  normalizeNotificationIndex,
  BANNER_TARGET_TYPE,
  BANNER_TARGET_TYPE_LABEL,
  SELLER_BANNER_STATUS,
  SELLER_BANNER_STATUS_LABEL,
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  WALLET_TX_STATUS_LABEL,
  WALLET_TX_TYPE_LABEL,
  WALLET_REFERENCE_TYPE,
  DEPOSIT_SETTLE_TO,
  DEPOSIT_SETTLE_TO_LABEL,
  MIN_TOPUP_AMOUNT,
  MAX_TOPUP_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  MAX_WITHDRAW_AMOUNT,
  WITHDRAW_STATUS,
  WITHDRAW_STATUS_LABEL,
  SELLER_SUBSCRIPTION_STATUS,
  SELLER_SUBSCRIPTION_STATUS_LABEL,
  isSubscriptionActive,
  activeSubscriptionFilter,
  ...reservationOrderFlow,
};

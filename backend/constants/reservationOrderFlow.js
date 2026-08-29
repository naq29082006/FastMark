/**
 * FastMark — State machine đơn giữ hàng (Reservation).
 *
 * Tab UX (v2):
 *   pending (0) | holding (1) | dispute (3) | completed (2,4) | cancelled (5)
 *
 * Không có trạng thái mồ côi: mọi transition đều ghi cancelType (mã) + cancelNote (text, nếu có) + cocChuyenDen.
 */

const RESERVATION_CANCEL_REASON = {
  /** Seller từ chối đơn pending. */
  SELLER_REJECTED: "seller_rejected",
  /** Buyer hủy khi chờ xác nhận. */
  BUYER_CANCEL_PENDING: "buyer_cancel_pending",
  /** Quá giờ nhận mà seller chưa xác nhận. */
  CONFIRM_TIMEOUT: "confirm_timeout",
  /** Buyer quét QR / xác nhận nhận hàng. */
  BUYER_RECEIVED: "buyer_received",
  /** Seller hủy sau khi đã xác nhận giữ hàng. */
  SELLER_CANCEL_HOLDING: "seller_cancel_holding",
  /** Buyer hủy khi đang giữ hàng (trước giờ nhận). */
  BUYER_CANCEL_HOLDING: "buyer_cancel_holding",
  /** Buyer báo seller không có mặt. */
  BUYER_REPORT_SELLER_ABSENT: "buyer_report_seller_absent",
  /** Seller báo buyer không đến. */
  SELLER_REPORT_BUYER_NO_SHOW: "seller_report_buyer_no_show",
  /** Cả hai báo cáo — chờ admin. */
  DISPUTE_BOTH_REPORTED: "dispute_both_reported",
  /** Buyer khiếu nại sau khi đã nhận hàng (hàng thiếu, hỏng…). */
  BUYER_POST_DELIVERY_COMPLAINT: "buyer_post_delivery_complaint",
  /** Quá 48h sau giờ nhận, không ai báo cáo. */
  PICKUP_TIMEOUT: "pickup_timeout",
  /** Admin: buyer thắng tranh chấp. */
  ADMIN_BUYER_WIN: "admin_buyer_win",
  /** Admin: seller thắng tranh chấp. */
  ADMIN_SELLER_WIN: "admin_seller_win",
  /** Admin: giao dịch thành công. */
  ADMIN_COMPLETED: "admin_completed",
  /** Admin khóa tài khoản seller. */
  SELLER_ACCOUNT_LOCKED: "seller_account_locked",
  /** Admin khóa gian hàng (shop) — tài khoản seller vẫn hoạt động. */
  SELLER_SHOP_LOCKED: "seller_shop_locked",
  /** Admin khóa tài khoản buyer. */
  BUYER_ACCOUNT_LOCKED: "buyer_account_locked",
  /** Auto buyer thắng (seller không phản hồi 48h). */
  AUTO_BUYER_WIN: "auto_buyer_win",
  /** Auto seller thắng (buyer không phản hồi 48h). */
  AUTO_SELLER_WIN: "auto_seller_win",
  /** Buyer đồng ý mất cọc (forfeit). */
  BUYER_FORFEIT: "buyer_forfeit",
  /** Seller hoàn cọc sau quá giờ nhận hàng. */
  SELLER_REFUND_AFTER_PICKUP: "seller_refund_after_pickup",
};

/** Mã lý do tranh chấp (ReservationDispute.reason / Report). */
const RESERVATION_DISPUTE_REASON_CODE = {
  SELLER_ABSENT: "seller_absent",
  SHOP_CLOSED: "shop_closed",
  SELLER_NO_DELIVERY: "seller_no_delivery",
  OTHER: "other",
  BUYER_NO_SHOW: "buyer_no_show",
};

const VIEWER_ROLE = {
  BUYER: "buyer",
  SELLER: "seller",
};

/** Nhãn lý do theo góc nhìn người xem. */
const CANCEL_REASON_VIEW_LABELS = {
  [RESERVATION_CANCEL_REASON.SELLER_REJECTED]: {
    buyer: "Người bán đã từ chối yêu cầu giữ hàng.",
    seller: "Người bán đã từ chối yêu cầu giữ hàng",
  },
  [RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING]: {
    buyer: "Người mua đã hủy yêu cầu giữ hàng",
    seller: "Người mua đã hủy yêu cầu giữ hàng",
  },
  [RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT]: {
    buyer: "Đơn đã tự động hủy do người bán không xác nhận giữ hàng đúng hạn",
    seller: "Đơn đã tự động hủy do người bán không xác nhận giữ hàng đúng hạn",
  },
  [RESERVATION_CANCEL_REASON.BUYER_RECEIVED]: {
    buyer: "Đơn hàng đã hoàn thành",
    seller: "Đơn hàng đã hoàn thành",
  },
  [RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING]: {
    buyer: "Người bán đã hủy đơn.",
    seller: "Người bán đã hủy đơn.",
  },
  [RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING]: {
    buyer: "Người mua đã hủy đơn.",
    seller: "Người mua đã hủy đơn.",
  },
  [RESERVATION_CANCEL_REASON.BUYER_REPORT_SELLER_ABSENT]: {
    buyer: "Người mua đã báo cáo người bán không có mặt khi nhận hàng",
    seller: "Người mua báo cáo người bán không có mặt khi nhận hàng",
  },
  [RESERVATION_CANCEL_REASON.SELLER_REPORT_BUYER_NO_SHOW]: {
    buyer: "Người bán báo cáo người mua không đến nhận hàng",
    seller: "Người bán đã báo cáo người mua không đến nhận hàng",
  },
  [RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED]: {
    buyer: "Đơn hàng đang được xử lý tranh chấp",
    seller: "Đơn hàng đang được xử lý tranh chấp",
  },
  [RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT]: {
    buyer: "Người mua đã gửi khiếu nại sau khi nhận hàng",
    seller: "Người mua đã gửi khiếu nại sau khi nhận hàng",
  },
  [RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT]: {
    buyer: "Quá giờ nhận hàng, đơn đã tự động hủy do không có phản hồi từ hai bên.",
    seller: "Quá giờ nhận hàng, đơn đã tự động hủy do không có phản hồi từ hai bên.",
  },
  [RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN]: {
    buyer: "Admin xử lý tranh chấp.",
    seller: "Admin xử lý tranh chấp.",
  },
  [RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN]: {
    buyer: "Admin xử lý tranh chấp.",
    seller: "Admin xử lý tranh chấp.",
  },
  [RESERVATION_CANCEL_REASON.ADMIN_COMPLETED]: {
    buyer: "Đơn hàng đã hoàn thành",
    seller: "Đơn hàng đã hoàn thành",
  },
  [RESERVATION_CANCEL_REASON.SELLER_ACCOUNT_LOCKED]: {
    buyer: "Đơn bị hủy do tài khoản người bán bị khóa",
    seller: "Đơn bị hủy do tài khoản người bán bị khóa",
  },
  [RESERVATION_CANCEL_REASON.SELLER_SHOP_LOCKED]: {
    buyer: "Đơn bị hủy do gian hàng của người bán bị khóa",
    seller: "Đơn bị hủy do gian hàng người bán bị khóa",
  },
  [RESERVATION_CANCEL_REASON.BUYER_ACCOUNT_LOCKED]: {
    buyer: "Đơn bị hủy do tài khoản người mua bị khóa",
    seller: "Đơn bị hủy do tài khoản người mua bị khóa",
  },
  [RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN]: {
    buyer: "Người mua thắng tranh chấp do người bán không phản hồi trong thời hạn quy định",
    seller: "Người mua thắng tranh chấp do người bán không phản hồi trong thời hạn quy định",
  },
  [RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN]: {
    buyer: "Người mua thua tranh chấp do không phản hồi trong thời hạn quy định",
    seller: "Người bán thắng tranh chấp do người mua không phản hồi trong thời hạn quy định",
  },
  [RESERVATION_CANCEL_REASON.BUYER_FORFEIT]: {
    buyer: "Quá giờ nhận hàng, người mua đã đồng ý mất cọc.",
    seller: "Quá giờ nhận hàng, người mua đã đồng ý mất cọc.",
  },
  [RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP]: {
    buyer: "Quá giờ nhận hàng, người bán đã đồng ý hoàn cọc.",
    seller: "Quá giờ nhận hàng, người bán đã đồng ý hoàn cọc.",
  },
};

/** Map chuỗi lý do cũ (free text / nhãn ngắn) → mã reason. */
const LEGACY_CANCEL_REASON_ALIASES = {
  "Quá hạn xác nhận": RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT,
  "Bạn đã bỏ lỡ xác nhận": RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT,
  "Yêu cầu bị từ chối": RESERVATION_CANCEL_REASON.SELLER_REJECTED,
  "Người bán đã từ chối giữ hàng": RESERVATION_CANCEL_REASON.SELLER_REJECTED,
  "Bạn đã từ chối giữ hàng": RESERVATION_CANCEL_REASON.SELLER_REJECTED,
  "Bạn đã đồng ý mất cọc": RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  "Bạn đã đồng ý mất cọc sau quá giờ nhận hàng.": RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  "Người mua đã đồng ý mất cọc sau quá giờ nhận hàng.": RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  "Người bán đã hoàn cọc sau quá giờ nhận hàng.": RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP,
  "Bạn đã hoàn cọc cho người mua sau quá giờ nhận hàng.": RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP,
  "Quá hạn nhận hàng": RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT,
};

function normalizeCancelReasonCode(code) {
  const explicit = String(code || "").trim();
  if (!explicit) {
    return "";
  }
  if (CANCEL_REASON_VIEW_LABELS[explicit]) {
    return explicit;
  }
  return LEGACY_CANCEL_REASON_ALIASES[explicit] || explicit;
}

const {
  getReservationCancelType,
  getReservationCancelNoteRaw,
} = require("../utils/reservationCompat");

function resolveCancelReasonCodeFromReservation(reservation) {
  const fromReasonCode = normalizeCancelReasonCode(reservation?.reasonCode);
  if (CANCEL_REASON_VIEW_LABELS[fromReasonCode]) {
    return fromReasonCode;
  }

  const fromCancelType = normalizeCancelReasonCode(getReservationCancelType(reservation));
  if (CANCEL_REASON_VIEW_LABELS[fromCancelType]) {
    return fromCancelType;
  }

  // Legacy: mã lưu trong cancelNote trước khi tách cancelType / cancelNote.
  const legacyNoteCode = normalizeCancelReasonCode(getReservationCancelNoteRaw(reservation));
  if (CANCEL_REASON_VIEW_LABELS[legacyNoteCode]) {
    return legacyNoteCode;
  }

  return fromCancelType || fromReasonCode || legacyNoteCode;
}

function wasCancelledAfterPickup(reservation) {
  if (!reservation?.pickupTime) {
    return false;
  }
  const pickup = new Date(reservation.pickupTime);
  const cancelledAt = new Date(reservation?.cancelledAt || reservation?.UpdatedAt);
  if (!Number.isFinite(pickup.getTime()) || !Number.isFinite(cancelledAt.getTime())) {
    return false;
  }
  return cancelledAt.getTime() >= pickup.getTime();
}

const {
  normalizeReservationStatus,
  isPostPickupDisputeContext,
  isDepositSettled,
} = require("../utils/reservationStatus");

const SETTLE_BUYER = 1;
const SETTLE_SELLER = 2;

function isPostDeliveryDisputeReservation(reservation) {
  if (!reservation) {
    return false;
  }
  if (reservation.isPostDeliveryDispute === true) {
    return true;
  }
  if (String(reservation.disputeKind || "").trim() === "post_delivery") {
    return true;
  }
  const reason = normalizeCancelReasonCode(getReservationCancelType(reservation));
  if (reason === RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT) {
    return true;
  }
  const legacyReason = normalizeCancelReasonCode(getReservationCancelNoteRaw(reservation));
  if (legacyReason === RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT) {
    return true;
  }
  return isPostPickupDisputeContext(reservation);
}

/** Map tab API → status filter. */
const RESERVATION_TAB_STATUS_MAP = {
  pending: [0],
  holding: [1],
  dispute: [3],
  dispute_active: [3],
  dispute_resolved: [3],
  completed: [2, 4],
  completed_pickup: [2],
  pickup_confirmed: [2],
  cancelled: [5],
  all: null,
};

function normalizeViewerRole(role) {
  const raw = String(role || "").trim().toLowerCase();
  return raw === VIEWER_ROLE.SELLER ? VIEWER_ROLE.SELLER : VIEWER_ROLE.BUYER;
}

/**
 * Suy ra mã lý do từ bản ghi reservation (fallback cho data cũ).
 */
function inferCancelReasonCode(reservation) {
  const resolved = resolveCancelReasonCodeFromReservation(reservation);
  if (CANCEL_REASON_VIEW_LABELS[resolved]) {
    return resolved;
  }

  const explicit = resolved;

  const status = normalizeReservationStatus(reservation?.status, reservation);
  const cancelType = getReservationCancelType(reservation);
  const disputeByBuyer = Boolean(reservation?.disputeByBuyer);
  const disputeBySeller = Boolean(reservation?.disputeBySeller);

  if (status === 3) {
    if (isDepositSettled(reservation)) {
      const explicitSettled = resolveCancelReasonCodeFromReservation(reservation);
      if (CANCEL_REASON_VIEW_LABELS[explicitSettled]) {
        return explicitSettled;
      }
      const settleTo = Number(reservation?.cocChuyenDen);
      if (settleTo === SETTLE_BUYER) {
        if (cancelType === "system") {
          return RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN;
        }
        if (cancelType === "seller_after_accept") {
          return RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP;
        }
        return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
      }
      if (settleTo === SETTLE_SELLER) {
        if (cancelType === "system") {
          return RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN;
        }
        return RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN;
      }
    }
    if (isPostDeliveryDisputeReservation(reservation)) {
      return RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT;
    }
    if (disputeByBuyer && disputeBySeller) {
      return RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED;
    }
    if (disputeByBuyer) {
      return RESERVATION_CANCEL_REASON.BUYER_REPORT_SELLER_ABSENT;
    }
    if (disputeBySeller) {
      return RESERVATION_CANCEL_REASON.SELLER_REPORT_BUYER_NO_SHOW;
    }
    return RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED;
  }

  if (status === 4) {
    return RESERVATION_CANCEL_REASON.BUYER_RECEIVED;
  }

  if (cancelType === "seller_reject") {
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }

  if (status === 5) {
    if (cancelType === "buyer" && Number(reservation?.cocChuyenDen) === SETTLE_SELLER) {
      return RESERVATION_CANCEL_REASON.BUYER_FORFEIT;
    }
  }

  if (cancelType === "seller_after_accept") {
    if (
      explicit === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP ||
      wasCancelledAfterPickup(reservation)
    ) {
      return RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP;
    }
    return RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
  }
  if (cancelType === "buyer") {
    return status === 1 || reservation?.tgShopXN
      ? RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING
      : RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING;
  }
  if (cancelType === "system") {
    if (explicit.includes("xác nhận") || explicit.includes("shop chưa")) {
      return RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
    }
    if (explicit.includes("48 giờ") || explicit.includes("24 giờ") || explicit.includes("quá hạn")) {
      return RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
    }
    return RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
  }
  if (cancelType === "admin") {
    const settleTo = Number(reservation?.cocChuyenDen);
    if (settleTo === 1) {
      return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
    }
    if (settleTo === 2) {
      return RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN;
    }
    return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
  }

  if (status === 1) {
    if (cancelType === "system" || explicit.includes("xác nhận")) {
      return RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
    }
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }
  return explicit;
}

const GENERIC_ADMIN_RESOLUTION_NOTES = new Set([
  "Admin hoàn cọc cho người mua.",
  "Admin xử lý tranh chấp: đền cọc cho người bán.",
  "Shop tự hoàn cọc trong tranh chấp.",
  "Shop tự hoàn cọc cho người mua.",
  "Buyer đồng ý mất cọc.",
]);

function resolveAdminResolutionNote(reservation) {
  const note = String(reservation?.cancelNote || "").trim();
  if (!note || GENERIC_ADMIN_RESOLUTION_NOTES.has(note)) {
    return "";
  }
  if (/^[a-z0-9_]+$/i.test(note) && note.includes("_")) {
    return "";
  }
  return note;
}

function formatDisputeOutcomeLabel(baseLabel, code, reservation) {
  if (
    code !== RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN &&
    code !== RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN
  ) {
    return baseLabel;
  }
  const note = resolveAdminResolutionNote(reservation);
  return note ? `${baseLabel}. Lý do: ${note}` : baseLabel;
}

function getReservationReasonLabel(reservation, viewerRole = VIEWER_ROLE.BUYER) {
  const role = normalizeViewerRole(viewerRole);
  const status = Number(reservation?.status);

  if (status === 0) {
    return "";
  }

  const code = inferCancelReasonCode(reservation);
  const labels = CANCEL_REASON_VIEW_LABELS[code];
  if (labels) {
    const base = labels[role] || labels.buyer || "";
    return formatDisputeOutcomeLabel(base, code, reservation);
  }

  return "";
}

function getReservationReasonLabels(reservation) {
  return {
    reasonCode: inferCancelReasonCode(reservation),
    buyer: getReservationReasonLabel(reservation, VIEWER_ROLE.BUYER),
    seller: getReservationReasonLabel(reservation, VIEWER_ROLE.SELLER),
  };
}

module.exports = {
  RESERVATION_CANCEL_REASON,
  RESERVATION_DISPUTE_REASON_CODE,
  VIEWER_ROLE,
  CANCEL_REASON_VIEW_LABELS,
  RESERVATION_TAB_STATUS_MAP,
  normalizeViewerRole,
  normalizeCancelReasonCode,
  inferCancelReasonCode,
  getReservationReasonLabel,
  getReservationReasonLabels,
};

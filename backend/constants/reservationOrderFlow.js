/**
 * FastMark — State machine đơn giữ hàng (Reservation).
 *
 * Tab UX (5):
 *   pending (0) | holding (2) | dispute (4) | completed (3,5*) | cancelled (1,6,7)
 *   * AUTO_COMPLETED (5) chỉ còn cho admin hoàn tất tranh chấp / legacy.
 *
 * Không có trạng thái mồ côi: mọi transition đều ghi cancelReason (mã) + cancelledBy + depositSettleTo.
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
  /** Quá 24h sau giờ nhận, không ai báo cáo. */
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
  /** Auto buyer thắng (seller không phản hồi 24h). */
  AUTO_BUYER_WIN: "auto_buyer_win",
  /** Auto seller thắng (buyer không phản hồi 24h). */
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
    buyer: "Người bán đã từ chối giữ hàng.",
    seller: "Bạn đã từ chối giữ hàng.",
  },
  [RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING]: {
    buyer: "Bạn đã hủy đơn.",
    seller: "Người mua đã hủy đơn.",
  },
  [RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT]: {
    buyer: "Đơn đã bị hủy do người bán chưa xác nhận giữ hàng.",
    seller: "Đơn đã bị hủy do bạn chưa xác nhận giữ hàng.",
  },
  [RESERVATION_CANCEL_REASON.BUYER_RECEIVED]: {
    buyer: "Đã nhận hàng",
    seller: "Đã giao hàng",
  },
  [RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING]: {
    buyer: "Người bán đã hủy đơn. Tiền cọc đã được hoàn lại cho bạn.",
    seller: "Bạn đã hủy đơn. Tiền cọc đã được hoàn lại cho người mua.",
  },
  [RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING]: {
    buyer: "Bạn đã hủy đơn. Tiền cọc đã được chuyển cho người bán.",
    seller: "Người mua đã hủy đơn. Tiền cọc đã được chuyển cho bạn.",
  },
  [RESERVATION_CANCEL_REASON.BUYER_REPORT_SELLER_ABSENT]: {
    buyer: "Người bán không có mặt",
    seller: "Bạn không có mặt",
  },
  [RESERVATION_CANCEL_REASON.SELLER_REPORT_BUYER_NO_SHOW]: {
    buyer: "Bạn không đến nhận",
    seller: "Người mua không đến nhận",
  },
  [RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED]: {
    buyer: "Đang tranh chấp",
    seller: "Đang tranh chấp",
  },
  [RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT]: {
    buyer: "Đã gửi khiếu nại sau nhận hàng",
    seller: "Khách khiếu nại sau nhận hàng",
  },
  [RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT]: {
    buyer:
      "Quá giờ nhận hàng, đơn đã tự động hủy do không có phản hồi từ hai bên. Tiền cọc đã được chuyển cho người bán.",
    seller:
      "Quá giờ nhận hàng, đơn đã tự động hủy do không có phản hồi từ hai bên. Tiền cọc đã được chuyển cho bạn.",
  },
  [RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN]: {
    buyer: "Người bán vắng mặt",
    seller: "Không có mặt",
  },
  [RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN]: {
    buyer: "Bạn không đến nhận",
    seller: "Người mua không đến nhận",
  },
  [RESERVATION_CANCEL_REASON.ADMIN_COMPLETED]: {
    buyer: "Đã nhận hàng",
    seller: "Đã giao hàng",
  },
  [RESERVATION_CANCEL_REASON.SELLER_ACCOUNT_LOCKED]: {
    buyer: "Người bán bị khóa",
    seller: "Tài khoản bị khóa",
  },
  [RESERVATION_CANCEL_REASON.SELLER_SHOP_LOCKED]: {
    buyer: "Gian hàng bị khóa",
    seller: "Gian hàng bị khóa",
  },
  [RESERVATION_CANCEL_REASON.BUYER_ACCOUNT_LOCKED]: {
    buyer: "Tài khoản bị khóa",
    seller: "Người mua bị khóa",
  },
  [RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN]: {
    buyer: "Người bán không phản hồi",
    seller: "Không phản hồi báo cáo",
  },
  [RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN]: {
    buyer: "Bạn không phản hồi báo cáo",
    seller: "Người mua không phản hồi",
  },
  [RESERVATION_CANCEL_REASON.BUYER_FORFEIT]: {
    buyer:
      "Quá giờ nhận hàng, bạn đã đồng ý mất cọc. Tiền cọc đã được chuyển cho người bán.",
    seller:
      "Quá giờ nhận hàng, người mua đã đồng ý mất cọc. Tiền cọc đã được chuyển cho bạn.",
  },
  [RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP]: {
    buyer:
      "Quá giờ nhận hàng, người bán đã hoàn cọc cho bạn. Tiền cọc đã được hoàn lại vào ví của bạn.",
    seller:
      "Quá giờ nhận hàng, bạn đã hoàn cọc cho người mua. Tiền cọc đã được hoàn lại cho người mua.",
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

function resolveCancelReasonCodeFromReservation(reservation) {
  const fromReasonCode = normalizeCancelReasonCode(reservation?.reasonCode);
  if (CANCEL_REASON_VIEW_LABELS[fromReasonCode]) {
    return fromReasonCode;
  }
  const fromCancelReason = normalizeCancelReasonCode(reservation?.cancelReason);
  if (CANCEL_REASON_VIEW_LABELS[fromCancelReason]) {
    return fromCancelReason;
  }
  return fromCancelReason || fromReasonCode;
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

/** Map tab API → status filter. */
const RESERVATION_TAB_STATUS_MAP = {
  pending: [0],
  /** Chỉ đơn đang chờ khách nhận (xác nhận xong → 2). */
  holding: [2],
  dispute: [4],
  completed: [3, 5],
  /** Legacy từ chối/hủy (1), hủy chuẩn (6), resolved (7). */
  cancelled: [1, 6, 7],
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

  const status = Number(reservation?.status);
  const cancelledBy = String(reservation?.cancelledBy || "").trim();
  const disputeByBuyer = Boolean(reservation?.disputeByBuyer);
  const disputeBySeller = Boolean(reservation?.disputeBySeller);

  if (status === 4) {
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

  if (status === 3 || status === 5) {
    return RESERVATION_CANCEL_REASON.BUYER_RECEIVED;
  }

  if (cancelledBy === "seller_reject") {
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }
  if (cancelledBy === "seller_after_accept" || reservation?.cancelledBySellerAfterAccept) {
    if (
      explicit === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP ||
      wasCancelledAfterPickup(reservation)
    ) {
      return RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP;
    }
    return RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
  }
  if (cancelledBy === "buyer") {
    return status === 2 || reservation?.sellerConfirmedAt
      ? RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING
      : RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING;
  }
  if (cancelledBy === "system") {
    if (explicit.includes("xác nhận") || explicit.includes("shop chưa")) {
      return RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
    }
    if (explicit.includes("24 giờ") || explicit.includes("quá hạn")) {
      return RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
    }
    return RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
  }
  if (cancelledBy === "admin") {
    const settleTo = Number(reservation?.depositSettleTo);
    if (settleTo === 1) {
      return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
    }
    if (settleTo === 2) {
      return RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN;
    }
    return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
  }

  if (status === 1) {
    if (cancelledBy === "system" || explicit.includes("xác nhận")) {
      return RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
    }
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }
  if (status === 6) {
    if (disputeByBuyer || disputeBySeller) {
      return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
    }
    if (cancelledBy === "seller_after_accept" || reservation?.cancelledBySellerAfterAccept) {
      return wasCancelledAfterPickup(reservation)
        ? RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP
        : RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
    }
    return RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING;
  }
  if (status === 7) {
    if (CANCEL_REASON_VIEW_LABELS[explicit]) {
      return explicit;
    }
    if (cancelledBy === "buyer" && Number(reservation?.depositSettleTo) === 2) {
      return RESERVATION_CANCEL_REASON.BUYER_FORFEIT;
    }
    const settleTo = Number(reservation?.depositSettleTo);
    if (settleTo === 1) {
      return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
    }
    return RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
  }

  return explicit;
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
    return labels[role] || labels.buyer || "";
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

require("../config/env");
const assert = require("assert");
const { RESERVATION_STATUS, DEPOSIT_SETTLE_TO, RESERVATION_CANCEL_REASON } = require("../constants");
const {
  applyDisputeResolution,
  buildActionFlags,
} = require("../services/reservationService");
const {
  isDisputeResolved,
  isActiveDispute,
  normalizeReservationStatus,
} = require("../utils/reservationStatus");
const {
  getReservationReasonLabel,
  inferCancelReasonCode,
} = require("../constants/reservationOrderFlow");
const { getReservationCancelNote } = require("../utils/reservationCompat");
const { disputeViewFromRecord } = require("../utils/reservationDisputeView");
const { DISPUTE_REASON_TYPE, DISPUTE_STATUS } = require("../constants");
const { resolveReservationTabFilter } = require("../utils/reservationTabFilter");

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("applyDisputeResolution giữ status 3", () => {
  const reservation = { status: RESERVATION_STATUS.DISPUTED };
  applyDisputeResolution(reservation, {
    cocChuyenDen: DEPOSIT_SETTLE_TO.SELLER,
    cancelType: RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN,
  });
  assert.strictEqual(Number(reservation.status), RESERVATION_STATUS.DISPUTED);
});

test("applyDisputeResolution set seller win", () => {
  const reservation = { status: RESERVATION_STATUS.DISPUTED };
  applyDisputeResolution(reservation, {
    cocChuyenDen: DEPOSIT_SETTLE_TO.SELLER,
    cancelType: RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN,
  });
  assert.strictEqual(reservation.cocChuyenDen, DEPOSIT_SETTLE_TO.SELLER);
});

test("isDisputeResolved sau admin", () => {
  const reservation = {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.BUYER,
  };
  assert.strictEqual(isDisputeResolved(reservation), true);
});

test("!isActiveDispute sau admin", () => {
  const reservation = {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.BUYER,
  };
  assert.strictEqual(isActiveDispute(reservation), false);
});

test("buildActionFlags khóa action khi resolved", () => {
  const reservation = {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.SELLER,
    cancelType: RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN,
  };
  const flags = buildActionFlags(reservation);
  assert.strictEqual(flags.canReportShop, false);
  assert.strictEqual(flags.withinDepositDecisionWindow, false);
});

test("normalize legacy 6 → 3", () => {
  assert.strictEqual(normalizeReservationStatus(6, { status: 6 }), RESERVATION_STATUS.DISPUTED);
});

test("inferCancelReasonCode AUTO_BUYER_WIN", () => {
  const autoBuyer = {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.BUYER,
    cancelType: RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN,
  };
  assert.strictEqual(
    inferCancelReasonCode(autoBuyer),
    RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN
  );
});

test("inferCancelReasonCode SELLER_REFUND_AFTER_PICKUP", () => {
  const sellerRefund = {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.BUYER,
    cancelType: RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP,
  };
  assert.strictEqual(
    inferCancelReasonCode(sellerRefund),
    RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP
  );
});

test("inferCancelReasonCode BUYER_FORFEIT", () => {
  const forfeit = {
    status: RESERVATION_STATUS.CANCELLED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.SELLER,
    cancelType: RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  };
  assert.strictEqual(
    inferCancelReasonCode(forfeit),
    RESERVATION_CANCEL_REASON.BUYER_FORFEIT
  );
});

test("cancelNote không trả mã hệ thống", () => {
  const reservation = {
    cancelType: RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN,
    cancelNote: "admin_buyer_win",
  };
  assert.strictEqual(getReservationCancelNote(reservation), "");
});

test("cancelNote giữ text seller/admin", () => {
  const reservation = {
    cancelType: RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING,
    cancelNote: "Sản phẩm hết hàng.",
  };
  assert.strictEqual(getReservationCancelNote(reservation), "Sản phẩm hết hàng.");
});

test("disputeViewFromRecord tách lý do buyer/seller khi cả hai báo cáo", () => {
  const view = disputeViewFromRecord({
    status: DISPUTE_STATUS.OPEN,
    maLyDoBuyer: DISPUTE_REASON_TYPE.SHOP_NOT_FOUND,
    buyerContent: "Người bán không có mặt",
    tgKnBuyer: new Date("2026-01-01T10:00:00Z"),
    maLyDoShop: DISPUTE_REASON_TYPE.OTHER,
    sellerContent: "Người mua đến muộn quá giờ",
    tgKnShop: new Date("2026-01-01T11:00:00Z"),
  });
  assert.strictEqual(view.disputeByBuyer, true);
  assert.strictEqual(view.disputeBySeller, true);
  assert.strictEqual(view.buyerDisputeReason, "seller_absent");
  assert.strictEqual(view.sellerDisputeReason, "other");
  assert.strictEqual(view.sellerDisputeReasonLabel, "Khác");
});

test("nhãn 6 kết quả tranh chấp — buyer forfeit", () => {
  const reservation = {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.SELLER,
    cancelType: RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  };
  assert.strictEqual(
    getReservationReasonLabel(reservation, "buyer"),
    "Quá giờ nhận hàng, người mua đã đồng ý mất cọc."
  );
  assert.strictEqual(
    getReservationReasonLabel(reservation, "seller"),
    "Quá giờ nhận hàng, người mua đã đồng ý mất cọc."
  );
});

test("nhãn admin buyer win kèm lý do", () => {
  const reservation = {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: DEPOSIT_SETTLE_TO.BUYER,
    cancelType: RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN,
    cancelNote: "Shop đóng cửa không thông báo",
  };
  assert.strictEqual(
    getReservationReasonLabel(reservation, "buyer"),
    "Admin quyết định hoàn cọc cho bạn. Lý do: Shop đóng cửa không thông báo"
  );
});

test("applyDisputeResolution giữ status 3 khi buyer forfeit trong tranh chấp", () => {
  const reservation = { status: RESERVATION_STATUS.DISPUTED };
  applyDisputeResolution(reservation, {
    cocChuyenDen: DEPOSIT_SETTLE_TO.SELLER,
    cancelType: RESERVATION_CANCEL_REASON.BUYER_FORFEIT,
  });
  assert.strictEqual(Number(reservation.status), RESERVATION_STATUS.DISPUTED);
  assert.strictEqual(reservation.cancelType, RESERVATION_CANCEL_REASON.BUYER_FORFEIT);
});

test("tab completed (Tất cả) gồm đã nhận hàng + hoàn thành", () => {
  const filter = resolveReservationTabFilter("completed");
  assert.deepStrictEqual(filter.statusFilter, [
    RESERVATION_STATUS.PICKUP_CONFIRMED,
    RESERVATION_STATUS.COMPLETED,
  ]);
});

test("tab completed_pickup chỉ đã nhận hàng", () => {
  const filter = resolveReservationTabFilter("completed_pickup");
  assert.deepStrictEqual(filter.statusFilter, [RESERVATION_STATUS.PICKUP_CONFIRMED]);
});

test("tab completed_done chỉ hoàn thành", () => {
  const filter = resolveReservationTabFilter("completed_done");
  assert.deepStrictEqual(filter.statusFilter, [RESERVATION_STATUS.COMPLETED]);
});

test("tab dispute_active vs dispute_history tách đúng", () => {
  const active = resolveReservationTabFilter("dispute_active");
  const history = resolveReservationTabFilter("dispute_history");
  assert.deepStrictEqual(active.statusFilter, [RESERVATION_STATUS.DISPUTED]);
  assert.deepStrictEqual(history.statusFilter, [RESERVATION_STATUS.DISPUTED]);
  assert.strictEqual(active.extraQuery.cocChuyenDen, DEPOSIT_SETTLE_TO.NONE);
  assert.ok(Array.isArray(history.extraQuery.cocChuyenDen.$in));
});

console.log("\nAll flow logic tests passed.");

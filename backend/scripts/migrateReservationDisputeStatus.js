/**
 * Migrate Reservation status 6 (DisputeCompleted) → 3 (Disputed).
 * Also repairs dispute-related records wrongly stored as CANCELLED (5).
 *
 * Usage: node backend/scripts/migrateReservationDisputeStatus.js
 */
require("../config/env");
const connectDB = require("../config/database");
const Reservation = require("../models/Reservation");
const { DEPOSIT_SETTLE_TO, RESERVATION_STATUS } = require("../constants");

const DISPUTE_CANCEL_REASONS = new Set([
  "buyer_report_seller_absent",
  "seller_report_buyer_no_show",
  "dispute_both_reported",
  "buyer_post_delivery_complaint",
  "admin_buyer_win",
  "admin_seller_win",
  "auto_buyer_win",
  "auto_seller_win",
]);

function inferDepositSettleTo(doc) {
  const existing = Number(doc.cocChuyenDen);
  if (existing === DEPOSIT_SETTLE_TO.BUYER || existing === DEPOSIT_SETTLE_TO.SELLER) {
    return existing;
  }
  const reason = String(doc.cancelNote || "").trim().toLowerCase();
  if (reason.includes("buyer_win") || reason.includes("admin_buyer") || reason.includes("auto_buyer")) {
    return DEPOSIT_SETTLE_TO.BUYER;
  }
  if (reason.includes("seller_win") || reason.includes("admin_seller") || reason.includes("auto_seller")) {
    return DEPOSIT_SETTLE_TO.SELLER;
  }
  if (doc.disputeByBuyer && !doc.disputeBySeller) {
    return DEPOSIT_SETTLE_TO.BUYER;
  }
  if (doc.disputeBySeller && !doc.disputeByBuyer) {
    return DEPOSIT_SETTLE_TO.SELLER;
  }
  return DEPOSIT_SETTLE_TO.NONE;
}

function shouldRepairCancelledDispute(doc) {
  if (Number(doc.status) !== RESERVATION_STATUS.CANCELLED) {
    return false;
  }
  if (doc.hasDispute || doc.disputed || doc.disputeByBuyer || doc.disputeBySeller || doc.disputedAt) {
    return true;
  }
  const reason = String(doc.cancelNote || "").trim().toLowerCase();
  return DISPUTE_CANCEL_REASONS.has(reason);
}

async function run() {
  await connectDB();
  const col = Reservation.collection;
  let fromSix = 0;
  let fromCancelled = 0;

  const cursor = col.find({
    $or: [{ status: 6 }, { status: 7 }],
  });

  for await (const doc of cursor) {
    const settleTo = inferDepositSettleTo(doc);
    const patch = {
      status: RESERVATION_STATUS.DISPUTED,
      updatedAt: new Date(),
    };
    if (settleTo !== DEPOSIT_SETTLE_TO.NONE) {
      patch.cocChuyenDen = settleTo;
      if (!doc.tgGiaiCoc) {
        patch.tgGiaiCoc = doc.cancelledAt || doc.updatedAt || new Date();
      }
    }
    await col.updateOne({ _id: doc._id }, { $set: patch });
    fromSix += 1;
  }

  const cancelledCursor = col.find({ status: RESERVATION_STATUS.CANCELLED });
  for await (const doc of cancelledCursor) {
    if (!shouldRepairCancelledDispute(doc)) {
      continue;
    }
    const settleTo = inferDepositSettleTo(doc);
    const patch = {
      status: RESERVATION_STATUS.DISPUTED,
      updatedAt: new Date(),
    };
    if (settleTo !== DEPOSIT_SETTLE_TO.NONE) {
      patch.cocChuyenDen = settleTo;
      if (!doc.tgGiaiCoc) {
        patch.tgGiaiCoc = doc.cancelledAt || doc.updatedAt || new Date();
      }
    }
    await col.updateOne({ _id: doc._id }, { $set: patch });
    fromCancelled += 1;
  }

  console.log(
    `migrateReservationDisputeStatus: status 6/7 → 3: ${fromSix}, cancelled dispute → 3: ${fromCancelled}`
  );
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

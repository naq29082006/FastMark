/**
 * Rà soát data + logic status Reservation (read-only trừ khi truyền --fix-labels).
 * Usage: node backend/scripts/auditReservationStatusFlow.js
 */
require("../config/env");
const connectDB = require("../config/database");
const Reservation = require("../models/Reservation");
const { RESERVATION_STATUS, DEPOSIT_SETTLE_TO } = require("../constants");
const { normalizeReservationStatus, isDepositSettled } = require("../utils/reservationStatus");
const { inferCancelReasonCode } = require("../constants/reservationOrderFlow");

const ISSUES = [];

function issue(code, message, sample = null) {
  ISSUES.push({ code, message, sample });
}

async function auditData() {
  const statusCounts = await Reservation.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const legacySix = await Reservation.countDocuments({ status: { $in: [6, 7] } });
  if (legacySix > 0) {
    issue("LEGACY_STATUS_6_7", `Còn ${legacySix} đơn status 6/7 — cần chạy migrateReservationDisputeStatus.js`);
  }

  const disputedSettled = await Reservation.countDocuments({
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: { $in: [DEPOSIT_SETTLE_TO.BUYER, DEPOSIT_SETTLE_TO.SELLER] },
  });

  const disputedActive = await Reservation.countDocuments({
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: { $in: [0, null] },
  });

  const cancelledWithDispute = await Reservation.countDocuments({
    status: RESERVATION_STATUS.CANCELLED,
    $or: [
      { disputeByBuyer: true },
      { disputeBySeller: true },
      { disputedAt: { $ne: null } },
    ],
  });
  if (cancelledWithDispute > 0) {
    issue(
      "CANCELLED_WITH_DISPUTE",
      `Còn ${cancelledWithDispute} đơn CANCELLED (5) có cờ tranh chấp — có thể cần migrate`,
    );
  }

  const completedWithDispute = await Reservation.countDocuments({
    status: RESERVATION_STATUS.COMPLETED,
    $or: [{ disputeByBuyer: true }, { disputeBySeller: true }],
  });
  if (completedWithDispute > 0) {
    issue(
      "COMPLETED_WITH_DISPUTE",
      `Còn ${completedWithDispute} đơn COMPLETED (4) có cờ tranh chấp — kiểm tra thủ công`,
    );
  }

  return {
    statusCounts,
    disputedSettled,
    disputedActive,
    legacySix,
    cancelledWithDispute,
    completedWithDispute,
  };
}

async function auditSamples() {
  const samples = await Reservation.find({ status: { $in: [6, 7] } })
    .select("_id status cocChuyenDen cancelNote")
    .limit(5)
    .lean();

  for (const row of samples) {
    issue("SAMPLE_LEGACY", `Legacy status ${row.status}`, {
      id: String(row._id),
      cocChuyenDen: row.cocChuyenDen,
    });
  }

  const disputedRows = await Reservation.find({ status: RESERVATION_STATUS.DISPUTED })
    .select("_id status cocChuyenDen tgNhanHang cancelNote cancelType")
    .limit(20)
    .lean();

  for (const row of disputedRows) {
    const normalized = normalizeReservationStatus(row.status, row);
    if (normalized !== RESERVATION_STATUS.DISPUTED) {
      issue("NORMALIZE_MISMATCH", `status ${row.status} normalize → ${normalized}`, {
        id: String(row._id),
      });
    }
    try {
      inferCancelReasonCode(row);
    } catch (error) {
      issue("INFER_REASON_ERROR", error.message, { id: String(row._id) });
    }
    const settled = isDepositSettled(row);
    const settleTo = Number(row.cocChuyenDen);
    if (settled && settleTo === 0) {
      issue("SETTLED_BUT_ZERO", "cocChuyenDen=0 nhưng isDepositSettled=true", {
        id: String(row._id),
      });
    }
  }
}

async function auditLogic() {
  const { applyDisputeResolution } = require("../services/reservationService");
  const mock = {
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: 0,
    tgGiaiCoc: null,
    cancelNote: "",
    cancelType: "",
    updatedAt: null,
  };
  applyDisputeResolution(mock, {
    cocChuyenDen: DEPOSIT_SETTLE_TO.SELLER,
    cancelType: "admin_seller_win",
    cancelNote: "Shop không có mặt tại điểm giao.",
  });
  if (mock.status !== RESERVATION_STATUS.DISPUTED) {
    issue("APPLY_RESOLUTION", `applyDisputeResolution đổi status → ${mock.status}, expected 3`);
  }
  if (Number(mock.cocChuyenDen) !== DEPOSIT_SETTLE_TO.SELLER) {
    issue("APPLY_RESOLUTION", "cocChuyenDen không được set đúng");
  }
}

async function run() {
  await connectDB();
  console.log("=== Audit Reservation Status Flow ===\n");

  const stats = await auditData();
  console.log("Status distribution:", stats.statusCounts);
  console.log("Disputed active:", stats.disputedActive);
  console.log("Disputed settled:", stats.disputedSettled);
  console.log("Legacy 6/7:", stats.legacySix);
  console.log("");

  await auditSamples();
  await auditLogic();

  if (ISSUES.length === 0) {
    console.log("✓ Không phát hiện vấn đề.");
  } else {
    console.log(`✗ ${ISSUES.length} vấn đề:\n`);
    for (const row of ISSUES) {
      console.log(`[${row.code}] ${row.message}`);
      if (row.sample) {
        console.log("  ", JSON.stringify(row.sample));
      }
    }
  }

  process.exit(ISSUES.length > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

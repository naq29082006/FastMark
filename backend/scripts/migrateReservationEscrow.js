/**
 * Migration an toàn — Escrow 7 ngày + ReservationDispute.
 *
 * Chạy: node backend/scripts/migrateReservationEscrow.js
 *
 * 1) Thêm field mặc định: disputed, hanGiaiCoc, pickup-expire fields
 * 2) Map status legacy:
 *    - status 7 (DISPUTE_RESOLVED) → 5 hoặc 6 theo cocChuyenDen
 *    - status 3 đã settle seller → 5 Completed (nếu chưa disputed)
 *    - status 3 chưa settle + completedAt → 3 Received + hanGiaiCoc
 * 3) disputed = true nếu có disputeByBuyer/disputeBySeller legacy hoặc status=4
 * 4) $unset paymentStatus (dùng cocChuyenDen)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const {
  RESERVATION_STATUS,
  DEPOSIT_SETTLE_TO,
  ESCROW_PROTECTION_MS,
} = require("../constants");

async function connectDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Thiếu MONGODB_URI / MONGO_URI trong .env");
  }
  await mongoose.connect(uri);
  console.log("[migrateReservationEscrow] Connected");
}

function mapLegacyStatus(doc) {
  let status = Number(doc.status);
  const disputedLegacy = Boolean(doc.disputeByBuyer || doc.disputeBySeller);

  if (status === 7) {
    const settleTo = Number(doc.cocChuyenDen);
    status =
      settleTo === DEPOSIT_SETTLE_TO.BUYER
        ? RESERVATION_STATUS.REFUNDED
        : RESERVATION_STATUS.COMPLETED;
  }

  if (status === 3 && !disputedLegacy) {
    const settleTo = Number(doc.cocChuyenDen);
    if (settleTo === DEPOSIT_SETTLE_TO.SELLER || doc.depositReleasedAt) {
      status = RESERVATION_STATUS.COMPLETED;
    } else if (settleTo === DEPOSIT_SETTLE_TO.BUYER || doc.depositRefundedAt) {
      status = RESERVATION_STATUS.REFUNDED;
    } else if (doc.completedAt) {
      status = RESERVATION_STATUS.RECEIVED;
    }
  }

  if (status === 5 && disputedLegacy && Number(doc.cocChuyenDen) === DEPOSIT_SETTLE_TO.BUYER) {
    status = RESERVATION_STATUS.REFUNDED;
  }

  return status;
}

async function migrate() {
  const cursor = Reservation.find({}).cursor();
  let updated = 0;

  for await (const doc of cursor) {
    const $set = {};
    const $unset = { paymentStatus: "" };
    const status = mapLegacyStatus(doc);

    if (Number(doc.status) !== status) {
      $set.status = status;
    }

    const disputed =
      Boolean(doc.disputed) ||
      Boolean(doc.disputeByBuyer || doc.disputeBySeller) ||
      status === RESERVATION_STATUS.DISPUTED;
    if (doc.disputed !== disputed) {
      $set.disputed = disputed;
    }

    if (status === RESERVATION_STATUS.RECEIVED && doc.completedAt && !doc.hanGiaiCoc) {
      const completedAt = new Date(doc.completedAt);
      $set.hanGiaiCoc = new Date(completedAt.getTime() + ESCROW_PROTECTION_MS);
      $set.reviewDeadlineAt = $set.hanGiaiCoc;
    }

    if (!doc.hanGiaiCoc && doc.reviewDeadlineAt) {
      $set.hanGiaiCoc = doc.reviewDeadlineAt;
    }
    if (!doc.hanGiaiCoc && doc.autoReleaseAt && status === RESERVATION_STATUS.RECEIVED) {
      $set.hanGiaiCoc = doc.autoReleaseAt;
    }

    if (Object.keys($set).length || Object.keys($unset).length) {
      $set.UpdatedAt = new Date();
      await Reservation.updateOne({ _id: doc._id }, { $set, $unset });
      updated += 1;
    }
  }

  console.log(`[migrateReservationEscrow] Updated ${updated} reservations`);
}

async function main() {
  try {
    await connectDb();
    await migrate();
  } catch (error) {
    console.error("[migrateReservationEscrow] failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();

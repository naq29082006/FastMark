/**
 * Chuẩn hóa cancelType / cancelNote:
 *   - cancelType = mã RESERVATION_CANCEL_REASON
 *   - cancelNote = text seller/admin (không lưu mã hệ thống)
 *
 * Usage: node backend/scripts/migrateReservationCancelFields.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const {
  RESERVATION_CANCEL_REASON,
  normalizeCancelReasonCode,
} = require("../constants/reservationOrderFlow");
const { LEGACY_ACTOR_CANCEL_TYPES } = require("../utils/reservationCompat");

const REASON_CODES = new Set(Object.values(RESERVATION_CANCEL_REASON));

function pickString(value) {
  return String(value || "").trim();
}

function isReasonCode(value) {
  const normalized = normalizeCancelReasonCode(value);
  return REASON_CODES.has(normalized);
}

function mapLegacyActorToReason(actor, noteCode, reservation) {
  const status = Number(reservation?.status);
  const settleTo = Number(reservation?.cocChuyenDen);

  if (isReasonCode(noteCode)) {
    return normalizeCancelReasonCode(noteCode);
  }

  if (actor === "seller_reject") {
    return RESERVATION_CANCEL_REASON.SELLER_REJECTED;
  }
  if (actor === "seller_after_accept") {
    if (noteCode === RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP) {
      return RESERVATION_CANCEL_REASON.SELLER_REFUND_AFTER_PICKUP;
    }
    return RESERVATION_CANCEL_REASON.SELLER_CANCEL_HOLDING;
  }
  if (actor === "buyer") {
    if (noteCode === RESERVATION_CANCEL_REASON.BUYER_FORFEIT || settleTo === 2) {
      return RESERVATION_CANCEL_REASON.BUYER_FORFEIT;
    }
    return status === 1 || reservation?.tgShopXN
      ? RESERVATION_CANCEL_REASON.BUYER_CANCEL_HOLDING
      : RESERVATION_CANCEL_REASON.BUYER_CANCEL_PENDING;
  }
  if (actor === "system") {
    if (noteCode === RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT) {
      return RESERVATION_CANCEL_REASON.CONFIRM_TIMEOUT;
    }
    if (noteCode === RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN) {
      return RESERVATION_CANCEL_REASON.AUTO_BUYER_WIN;
    }
    if (noteCode === RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN) {
      return RESERVATION_CANCEL_REASON.AUTO_SELLER_WIN;
    }
    return RESERVATION_CANCEL_REASON.PICKUP_TIMEOUT;
  }
  if (actor === "admin") {
    if (isReasonCode(noteCode)) {
      return normalizeCancelReasonCode(noteCode);
    }
    if (settleTo === 1) {
      return RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
    }
    if (settleTo === 2) {
      return RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN;
    }
  }

  return "";
}

async function migrateReservationCancelFields() {
  const col = mongoose.connection.collection("reservations");
  const cursor = col.find({});

  let count = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const set = {};
    const unset = {};

    const legacyType = pickString(doc.cancelledBy);
    const legacyReason = pickString(doc.cancelReason);
    let cancelType = pickString(doc.cancelType) || legacyType;
    let cancelNote = pickString(doc.cancelNote) || legacyReason;

    const noteLooksLikeCode = isReasonCode(cancelNote);
    const typeLooksLikeCode = isReasonCode(cancelType);
    const typeIsLegacyActor = LEGACY_ACTOR_CANCEL_TYPES.has(cancelType);

    let nextType = "";
    let nextNote = cancelNote;

    if (typeLooksLikeCode) {
      nextType = normalizeCancelReasonCode(cancelType);
      if (noteLooksLikeCode) {
        nextNote = "";
      }
    } else if (noteLooksLikeCode) {
      nextType = normalizeCancelReasonCode(cancelNote);
      nextNote = "";
    } else if (typeIsLegacyActor) {
      nextType = mapLegacyActorToReason(cancelType, cancelNote, doc);
      if (isReasonCode(nextNote)) {
        nextNote = "";
      }
    }

    if (nextType && nextType !== pickString(doc.cancelType)) {
      set.cancelType = nextType;
    } else if (!pickString(doc.cancelType) && nextType) {
      set.cancelType = nextType;
    }

    if (noteLooksLikeCode || (nextNote !== pickString(doc.cancelNote) && nextNote === "")) {
      set.cancelNote = nextNote;
    }

    if (doc.cancelledBy !== undefined) {
      unset.cancelledBy = "";
    }
    if (doc.cancelReason !== undefined) {
      unset.cancelReason = "";
    }
    if (doc.cancelledBySellerAfterAccept !== undefined) {
      unset.cancelledBySellerAfterAccept = "";
    }

    if (Object.keys(set).length || Object.keys(unset).length) {
      await col.updateOne({ _id: doc._id }, { $set: set, $unset: unset });
      count += 1;
    }
  }

  console.log(`Reservation cancel fields: migrated ${count} documents`);
  return count;
}

async function run() {
  await connectDB();
  const total = await migrateReservationCancelFields();
  console.log(`Done. Total migrated: ${total}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

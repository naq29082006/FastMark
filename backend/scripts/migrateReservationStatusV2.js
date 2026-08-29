/**
 * Migrate Reservation.status sang schema v2 (0–5).
 * Usage: node backend/scripts/migrateReservationStatusV2.js
 */
require("../config/env");
const connectDB = require("../config/database");
const Reservation = require("../models/Reservation");
const {
  LEGACY_STATUS_TO_V2,
  RESERVATION_STATUS_V2,
} = require("../utils/reservationStatus");
const { DEPOSIT_SETTLE_TO } = require("../constants");

function mapLegacyToV2(doc) {
  const legacy = Number(doc.status);
  let next = LEGACY_STATUS_TO_V2[legacy];
  if (next === undefined) {
    next = legacy;
  }
  if (legacy === 6 || legacy === 7) {
    next = RESERVATION_STATUS_V2.DISPUTED;
  } else if (legacy === 5) {
    next = RESERVATION_STATUS_V2.COMPLETED;
  } else if (legacy === 3) {
    next = RESERVATION_STATUS_V2.PICKUP_CONFIRMED;
  } else if (legacy === 4) {
    next = RESERVATION_STATUS_V2.DISPUTED;
  }
  if (
    next === RESERVATION_STATUS_V2.CANCELLED &&
    Number(doc.cocChuyenDen) === DEPOSIT_SETTLE_TO.SELLER &&
    (doc.hasDispute || doc.disputed)
  ) {
    next = RESERVATION_STATUS_V2.DISPUTED;
  }
  return next;
}

async function run() {
  await connectDB();
  const col = Reservation.collection;
  const cursor = col.find({});
  let updated = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const next = mapLegacyToV2(doc);
    if (Number(doc.status) !== next) {
      await col.updateOne({ _id: doc._id }, { $set: { status: next } });
      updated += 1;
    }
  }
  console.log(`Reservation status v2: updated ${updated} documents`);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

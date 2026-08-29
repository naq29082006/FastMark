/**
 * Gộp WalletTransaction.reservationId → referenceId/referenceType và xóa field legacy.
 * Usage: node backend/scripts/migrateWalletTransactionReference.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const WalletTransaction = require("../models/WalletTransaction");
const { WALLET_REFERENCE_TYPE } = require("../constants");

async function run() {
  await connectDB();
  const col = WalletTransaction.collection;

  const legacyRows = await col
    .find({ reservationId: { $exists: true, $ne: null } })
    .project({ reservationId: 1, referenceId: 1, referenceType: 1 })
    .toArray();

  let backfilled = 0;
  for (const doc of legacyRows) {
    const set = {};
    if (!doc.referenceId && doc.reservationId) {
      set.referenceId = doc.reservationId;
    }
    const refType = String(doc.referenceType || "").trim();
    if (!refType && doc.reservationId) {
      set.referenceType = WALLET_REFERENCE_TYPE.RESERVATION;
    }
    if (Object.keys(set).length) {
      await col.updateOne({ _id: doc._id }, { $set: set });
      backfilled += 1;
    }
  }

  const unset = await col.updateMany(
    { reservationId: { $exists: true } },
    { $unset: { reservationId: "" } }
  );

  try {
    const indexes = await col.indexes();
    for (const idx of indexes) {
      if (idx.key?.reservationId) {
        await col.dropIndex(idx.name);
        console.log(`Dropped index ${idx.name} on reservationId.`);
      }
    }
  } catch (error) {
    console.warn("[migrateWalletTransactionReference] drop index:", error?.message || error);
  }

  console.log(
    `WalletTransaction: backfilled reference on ${backfilled} doc(s); unset reservationId on ${unset.modifiedCount || 0} doc(s).`
  );
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

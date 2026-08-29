/**
 * Backfill WalletTransaction.reservationId từ referenceId khi referenceType = Reservation.
 * Usage: node backend/scripts/migrateWalletTransactionReservationId.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const WalletTransaction = require("../models/WalletTransaction");
const { WALLET_REFERENCE_TYPE } = require("../constants");

async function run() {
  await connectDB();
  const col = WalletTransaction.collection;

  const result = await col.updateMany(
    {
      referenceType: WALLET_REFERENCE_TYPE.RESERVATION,
      referenceId: { $exists: true, $ne: null },
      $or: [{ reservationId: { $exists: false } }, { reservationId: null }],
    },
    [{ $set: { reservationId: "$referenceId" } }]
  );

  console.log(
    `WalletTransaction: backfilled reservationId on ${result.modifiedCount || 0} doc(s).`
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

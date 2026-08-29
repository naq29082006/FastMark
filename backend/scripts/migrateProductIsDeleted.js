/**
 * Chuẩn hóa Product.IsDeleted: false/true (boolean cũ) → 1/0 (number mới).
 * Usage: node backend/scripts/migrateProductIsDeleted.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Product = require("../models/Product");
const { RECORD_STATUS } = require("../constants");

async function run() {
  await connectDB();
  const col = Product.collection;

  const activeFromFalse = await col.updateMany(
    { IsDeleted: false },
    { $set: { IsDeleted: RECORD_STATUS.ACTIVE } }
  );
  const removedFromTrue = await col.updateMany(
    { IsDeleted: true },
    { $set: { IsDeleted: RECORD_STATUS.HIDDEN } }
  );

  console.log(
    `Product IsDeleted: ${activeFromFalse.modifiedCount || 0} active (false→1), ${removedFromTrue.modifiedCount || 0} removed (true→0)`
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

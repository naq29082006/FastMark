/**
 * Chuyển trường xóa mềm / visibility từ boolean → 0/1 trên các collection catalog.
 * Usage: node backend/scripts/migrateRecordIsActive.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Bank = require("../models/Bank");
const SellerPlan = require("../models/SellerPlan");
const BannerPlan = require("../models/BannerPlan");
const ShopProfile = require("../models/ShopProfile");
const Review = require("../models/Review");
const { RECORD_STATUS } = require("../constants");

async function migrateCollection(Model, label) {
  const col = Model.collection;
  const activeResult = await col.updateMany(
    { isActive: true },
    { $set: { isActive: RECORD_STATUS.ACTIVE } }
  );
  const hiddenResult = await col.updateMany(
    { isActive: false },
    { $set: { isActive: RECORD_STATUS.HIDDEN } }
  );

  const converted =
    (activeResult.modifiedCount || 0) + (hiddenResult.modifiedCount || 0);
  console.log(
    `${label}: converted ${converted} (${activeResult.modifiedCount || 0} active, ${hiddenResult.modifiedCount || 0} hidden)`
  );
  return converted;
}

async function migrateReviewFlags() {
  const col = Review.collection;
  const deletedActive = await col.updateMany(
    { isDeleted: false },
    { $set: { isDeleted: RECORD_STATUS.ACTIVE } }
  );
  const deletedRemoved = await col.updateMany(
    { isDeleted: true },
    { $set: { isDeleted: RECORD_STATUS.HIDDEN } }
  );
  const hiddenVisible = await col.updateMany(
    { isHidden: false },
    { $set: { isHidden: 0 } }
  );
  const hiddenHidden = await col.updateMany(
    { isHidden: true },
    { $set: { isHidden: 1 } }
  );

  const converted =
    (deletedActive.modifiedCount || 0) +
    (deletedRemoved.modifiedCount || 0) +
    (hiddenVisible.modifiedCount || 0) +
    (hiddenHidden.modifiedCount || 0);
  console.log(
    `Review: converted ${converted} (isDeleted active ${deletedActive.modifiedCount || 0}, deleted ${deletedRemoved.modifiedCount || 0}, isHidden visible ${hiddenVisible.modifiedCount || 0}, hidden ${hiddenHidden.modifiedCount || 0})`
  );
  return converted;
}

async function run() {
  await connectDB();
  const total =
    (await migrateCollection(Bank, "Bank")) +
    (await migrateCollection(SellerPlan, "SellerPlan")) +
    (await migrateCollection(BannerPlan, "BannerPlan")) +
    (await migrateCollection(ShopProfile, "ShopProfile")) +
    (await migrateReviewFlags());
  console.log(`Done. Total converted: ${total}`);
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

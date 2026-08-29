/**
 * Chuẩn hóa Product.IsDeleted / RemovedBy — sửa data cũ null/false gây đếm sai thống kê admin.
 * Usage: node backend/scripts/migrateProductRemovalFields.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Product = require("../models/Product");
const { PRODUCT_REMOVED_BY } = require("../constants");

async function run() {
  await connectDB();
  const col = Product.collection;

  const activeFromLegacy = await col.updateMany(
    {
      $or: [
        { IsDeleted: { $exists: false } },
        { IsDeleted: null },
        { IsDeleted: false },
      ],
    },
    {
      $set: { IsDeleted: 1, UpdatedAt: new Date() },
      $unset: { RemovedBy: "", RemovedAt: "" },
    }
  );

  const clearRemovedMetaOnActive = await col.updateMany(
    {
      IsDeleted: 1,
      RemovedBy: { $in: [PRODUCT_REMOVED_BY.ADMIN, PRODUCT_REMOVED_BY.SELLER, ""] },
    },
    {
      $set: { RemovedBy: "", UpdatedAt: new Date() },
      $unset: { RemovedAt: "" },
    }
  );

  const removedFromTrue = await col.updateMany(
    { IsDeleted: true },
    {
      $set: {
        IsDeleted: 0,
        RemovedBy: PRODUCT_REMOVED_BY.SELLER,
        UpdatedAt: new Date(),
      },
    }
  );

  console.log(
    JSON.stringify(
      {
        activeFromLegacy: activeFromLegacy.modifiedCount || 0,
        clearRemovedMetaOnActive: clearRemovedMetaOnActive.modifiedCount || 0,
        removedFromTrue: removedFromTrue.modifiedCount || 0,
      },
      null,
      2
    )
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

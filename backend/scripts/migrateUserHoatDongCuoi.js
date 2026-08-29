/**
 * User.LanHoatDongCuoi → HoatDongCuoi
 * Usage: node backend/scripts/migrateUserHoatDongCuoi.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const User = require("../models/User");
const { MF } = require("../constants/modelFields");

async function run() {
  await connectDB();
  const col = User.collection;

  const legacy = await col
    .find({ LanHoatDongCuoi: { $exists: true } })
    .project({ LanHoatDongCuoi: 1, [MF.HoatDongCuoi]: 1 })
    .toArray();

  let migrated = 0;
  for (const doc of legacy) {
    const set = {};
    if (doc[MF.HoatDongCuoi] == null && doc.LanHoatDongCuoi != null) {
      set[MF.HoatDongCuoi] = doc.LanHoatDongCuoi;
    }
    if (Object.keys(set).length) {
      await col.updateOne({ _id: doc._id }, { $set: set });
      migrated += 1;
    }
  }

  const unset = await col.updateMany(
    { LanHoatDongCuoi: { $exists: true } },
    { $unset: { LanHoatDongCuoi: "" } }
  );

  console.log(`Backfilled HoatDongCuoi: ${migrated}`);
  console.log(`Unset LanHoatDongCuoi: ${unset.modifiedCount}`);
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

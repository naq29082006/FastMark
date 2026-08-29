/**
 * Migration: Follow.followedUserId → Follow.shopId
 *
 * Chạy một lần sau khi deploy schema mới:
 *   node backend/scripts/migrateFollowToShop.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const Follow = require("../models/Follow");
const ShopProfile = require("../models/ShopProfile");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Thiếu MONGODB_URI trong .env");
  }
  await mongoose.connect(uri);

  const legacy = await Follow.find({ followedUserId: { $exists: true, $ne: null } }).lean();
  let migrated = 0;
  let skipped = 0;
  let removed = 0;

  for (const row of legacy) {
    const shop = await ShopProfile.findOne({ userId: row.followedUserId })
      .sort({ CreatedAt: -1 })
      .select("_id")
      .lean();

    if (!shop?._id) {
      await Follow.deleteOne({ _id: row._id });
      removed += 1;
      continue;
    }

    const duplicate = await Follow.findOne({
      followerId: row.followerId,
      shopId: shop._id,
    }).lean();

    if (duplicate && String(duplicate._id) !== String(row._id)) {
      await Follow.deleteOne({ _id: row._id });
      removed += 1;
      continue;
    }

    await Follow.updateOne(
      { _id: row._id },
      {
        $set: { shopId: shop._id },
        $unset: { followedUserId: "" },
      }
    );
    migrated += 1;
  }

  const withoutShop = await Follow.countDocuments({
    $or: [{ shopId: { $exists: false } }, { shopId: null }],
  });
  skipped = withoutShop;

  console.log(
    JSON.stringify({ migrated, removed, remainingWithoutShopId: skipped }, null, 2)
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

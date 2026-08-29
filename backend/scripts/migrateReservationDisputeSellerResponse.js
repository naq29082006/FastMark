/**
 * Gộp phản hồi seller post-delivery vào sellerContent/sellerImages/tgKnShop;
 * xóa ndPhShop, anhPhShop, tgPhShop, hanPhShop.
 * Usage: node backend/scripts/migrateReservationDisputeSellerResponse.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const ReservationDispute = require("../models/ReservationDispute");

function hasSellerComplaint(doc) {
  const reasonType = Number(doc?.maLyDoShop);
  return Number.isFinite(reasonType) && reasonType > 0;
}

async function run() {
  await connectDB();
  const col = ReservationDispute.collection;

  const legacy = await col
    .find({
      $or: [
        { ndPhShop: { $exists: true, $ne: "" } },
        { anhPhShop: { $exists: true, $not: { $size: 0 } } },
        { tgPhShop: { $exists: true, $ne: null } },
        { hanPhShop: { $exists: true, $ne: null } },
      ],
    })
    .toArray();

  let merged = 0;
  for (const doc of legacy) {
    if (hasSellerComplaint(doc)) {
      continue;
    }

    const set = {};
    const responseContent = String(doc.ndPhShop || doc.sellerContent || "").trim();
    const responseImages = Array.isArray(doc.anhPhShop) && doc.anhPhShop.length
      ? doc.anhPhShop
      : doc.sellerImages;
    const respondedAt = doc.tgPhShop || doc.tgKnShop || null;

    if (responseContent && !String(doc.sellerContent || "").trim()) {
      set.sellerContent = responseContent;
    }
    if (Array.isArray(responseImages) && responseImages.length && !(doc.sellerImages || []).length) {
      set.sellerImages = responseImages;
    }
    if (respondedAt && !doc.tgKnShop) {
      set.tgKnShop = respondedAt;
    }
    if (doc.sellerShopId == null && doc.shopId) {
      set.sellerShopId = doc.shopId;
    }

    const unset = {};
    for (const key of ["ndPhShop", "anhPhShop", "tgPhShop", "hanPhShop"]) {
      if (doc[key] !== undefined) {
        unset[key] = "";
      }
    }

    const update = {};
    if (Object.keys(set).length) {
      update.$set = set;
    }
    if (Object.keys(unset).length) {
      update.$unset = unset;
    }
    if (Object.keys(update).length) {
      await col.updateOne({ _id: doc._id }, update);
      merged += 1;
    }
  }

  const unsetOnly = await col.updateMany(
    {
      $or: [
        { ndPhShop: { $exists: true } },
        { anhPhShop: { $exists: true } },
        { tgPhShop: { $exists: true } },
        { hanPhShop: { $exists: true } },
      ],
    },
    { $unset: { ndPhShop: "", anhPhShop: "", tgPhShop: "", hanPhShop: "" } }
  );

  try {
    const indexes = await col.indexes();
    for (const idx of indexes) {
      if (idx.key?.hanPhShop) {
        await col.dropIndex(idx.name);
        console.log(`Dropped index ${idx.name}`);
      }
    }
  } catch (error) {
    console.warn("[migrateReservationDisputeSellerResponse] drop index:", error?.message || error);
  }

  console.log(`Merged seller response fields on ${merged} doc(s).`);
  console.log(`Unset legacy fields on ${unsetOnly.modifiedCount || 0} doc(s).`);
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

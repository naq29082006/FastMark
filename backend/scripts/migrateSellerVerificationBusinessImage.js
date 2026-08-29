/**
 * Gộp businessDocType + businessDocImage → anhKD.
 * Usage: node backend/scripts/migrateSellerVerificationBusinessImage.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const SellerVerification = require("../models/SellerVerification");

function pickString(value) {
  return String(value || "").trim();
}

async function migrate() {
  const cursor = SellerVerification.find({}).cursor();
  let updated = 0;

  for await (const doc of cursor) {
    const imageUrl = pickString(
      doc.anhKD ?? doc.businessDocImage ?? doc.businessDoc?.imageUrl
    );
    const $set = {};
    const $unset = {};

    if (imageUrl && doc.anhKD !== imageUrl) {
      $set.anhKD = imageUrl;
    } else if (!doc.anhKD && imageUrl) {
      $set.anhKD = imageUrl;
    }

    if (doc.businessDocType !== undefined) {
      $unset.businessDocType = "";
    }
    if (doc.businessDocImage !== undefined) {
      $unset.businessDocImage = "";
    }
    if (doc.businessDoc !== undefined) {
      $unset.businessDoc = "";
    }

    if (Object.keys($set).length || Object.keys($unset).length) {
      $set.UpdatedAt = new Date();
      await SellerVerification.updateOne({ _id: doc._id }, { $set, $unset });
      updated += 1;
    }
  }

  console.log(`[migrateSellerVerificationBusinessImage] Updated ${updated} documents`);
}

async function run() {
  await connectDB();
  await migrate();
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("[migrateSellerVerificationBusinessImage] failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

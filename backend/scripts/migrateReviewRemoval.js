/**
 * Migrate Review removal fields → mẫu Product (removedBy / lyDoGo / removedAt).
 * Usage: node backend/scripts/migrateReviewRemoval.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Review = require("../models/Review");
const { RECORD_STATUS, REVIEW_REMOVED_BY } = require("../constants");

function pickString(value) {
  return String(value || "").trim();
}

async function migrateReviewRemoval() {
  const cursor = Review.find({}).cursor();
  let updated = 0;

  for await (const doc of cursor) {
    const $set = {};
    const $unset = {};
    const reason = pickString(doc.lyDoGo || doc.moderationReason);
    const removedAt = doc.removedAt || doc.deletedAt || null;
    const softDeleted =
      Number(doc.isDeleted) === RECORD_STATUS.HIDDEN || doc.isDeleted === true;
    const adminHidden = Number(doc.isHidden) === 1 || doc.isHidden === true;

    if (!pickString(doc.removedBy)) {
      if (adminHidden && !softDeleted) {
        $set.removedBy = REVIEW_REMOVED_BY.ADMIN;
      } else if (softDeleted) {
        $set.removedBy = reason ? REVIEW_REMOVED_BY.ADMIN : REVIEW_REMOVED_BY.BUYER;
      } else {
        $set.removedBy = "";
      }
    }

    if (reason && !pickString(doc.lyDoGo)) {
      $set.lyDoGo = reason;
    }

    if (removedAt && !doc.removedAt) {
      $set.removedAt = removedAt;
    }

    if (doc.isHidden !== undefined) {
      $unset.isHidden = "";
    }
    if (doc.moderationReason !== undefined) {
      $unset.moderationReason = "";
    }
    if (doc.deletedAt !== undefined) {
      $unset.deletedAt = "";
    }

    if (Object.keys($set).length || Object.keys($unset).length) {
      $set.UpdatedAt = new Date();
      await Review.updateOne({ _id: doc._id }, { $set, $unset });
      updated += 1;
    }
  }

  console.log(`[migrateReviewRemoval] Updated ${updated} reviews`);
  return updated;
}

async function run() {
  await connectDB();
  await migrateReviewRemoval();
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("[migrateReviewRemoval] failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

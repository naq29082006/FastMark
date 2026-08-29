/**
 * Migrate Report schema:
 * - Remap reportType legacy codes → 1–7
 * - $unset targetUserId
 * - Coerce reviewId string → ObjectId when valid
 *
 * Usage: node backend/scripts/migrateReportSchema.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const REPORT_TYPE_MAP = {
  2: 5,
  3: 2,
  4: 3,
  8: 4,
  9: 5,
  10: 6,
  11: 7,
};

async function migrateReports() {
  const col = mongoose.connection.collection("reports");
  const cursor = col.find({});
  let count = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const set = {};
    const unset = { targetUserId: "" };

    const legacyType = Number(doc.reportType);
    if (REPORT_TYPE_MAP[legacyType] != null) {
      set.reportType = REPORT_TYPE_MAP[legacyType];
    }

    if (doc.reviewId && typeof doc.reviewId === "string") {
      const raw = String(doc.reviewId).trim();
      if (/^[a-f\d]{24}$/i.test(raw)) {
        set.reviewId = new mongoose.Types.ObjectId(raw);
      }
    }

    if (Object.keys(set).length || Object.keys(unset).length) {
      await col.updateOne({ _id: doc._id }, { ...(Object.keys(set).length ? { $set: set } : {}), $unset: unset });
      count += 1;
    }
  }

  console.log(`Report: migrated ${count} documents`);
  return count;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }
  await mongoose.connect(uri);
  await migrateReports();
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

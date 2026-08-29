/**
 * Xóa báo cáo mồ côi: reportType=5 (Khác) nhưng không gắn review/shop/product
 * do bug legacy map trước đây. Chạy sau khi deploy fix createReport.
 *
 * Usage: node backend/scripts/migrateReportFixOrphans.js
 *        node backend/scripts/migrateReportFixOrphans.js --dry-run
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.collection("reports");

  const orphans = await col
    .find({
      reportType: 5,
      $and: [
        { $or: [{ productId: { $exists: false } }, { productId: null }] },
        { $or: [{ shopId: { $exists: false } }, { shopId: null }] },
        { $or: [{ reviewId: { $exists: false } }, { reviewId: null }] },
      ],
    })
    .toArray();

  console.log(`Found ${orphans.length} orphan report(s) with type 5 and no target.`);

  for (const doc of orphans) {
    console.log(`- ${doc._id} | ${doc.title || "(no title)"} | ${doc.CreatedAt || ""}`);
    if (!dryRun) {
      await col.deleteOne({ _id: doc._id });
    }
  }

  if (dryRun) {
    console.log("Dry run — no documents deleted.");
  } else {
    console.log(`Deleted ${orphans.length} orphan report(s).`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

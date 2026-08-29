/**
 * Gộp legacy ProductCategory.categoryName → name và xóa field categoryName.
 * Usage: node backend/scripts/migrateProductCategoryName.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const ProductCategory = require("../models/ProductCategory");

async function run() {
  await connectDB();
  const col = ProductCategory.collection;

  const legacyOnly = await col
    .find({
      $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
      categoryName: { $type: "string", $ne: "" },
    })
    .toArray();

  let copied = 0;
  for (const doc of legacyOnly) {
    const nextName = String(doc.categoryName || "").trim();
    if (!nextName) continue;
    await col.updateOne({ _id: doc._id }, { $set: { name: nextName } });
    copied += 1;
  }

  const unset = await col.updateMany(
    { categoryName: { $exists: true } },
    { $unset: { categoryName: "" } }
  );

  console.log(
    `ProductCategory: copied name from categoryName for ${copied} doc(s); unset categoryName on ${unset.modifiedCount || 0} doc(s).`
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

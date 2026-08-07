/**
 * Gộp ProductImage / ReviewImage / ReportImage vào trường images[] trên document cha.
 * Usage: node backend/scripts/migrateEmbeddedImages.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Product = require("../models/Product");
const Review = require("../models/Review");
const Report = require("../models/Report");
const { normalizeEmbeddedImages } = require("../utils/embeddedImages");

const MAX_IMAGES = 5;

function pickUrl(value) {
  return String(value || "").trim();
}

async function migrateProductImages() {
  const col = mongoose.connection.collection("productimages");
  const rows = await col
    .find({})
    .sort({ ProductId: 1, Stt: 1, UploadedAt: 1 })
    .toArray();

  const byProduct = new Map();
  for (const row of rows) {
    const key = String(row.ProductId);
    if (!byProduct.has(key)) {
      byProduct.set(key, []);
    }
    const url = pickUrl(row.ImageUrl);
    if (url) {
      byProduct.get(key).push(url);
    }
  }

  let updated = 0;
  for (const [productId, urls] of byProduct.entries()) {
    const images = normalizeEmbeddedImages(urls, MAX_IMAGES);
    const result = await Product.updateOne(
      {
        _id: new mongoose.Types.ObjectId(productId),
        $or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
      },
      { $set: { images } }
    );
    if (result.modifiedCount) {
      updated += 1;
    }
  }

  console.log(
    `Product: merged ${rows.length} ProductImage rows into ${byProduct.size} products (${updated} updated)`
  );
  return updated;
}

async function migrateReviewImages() {
  const col = mongoose.connection.collection("reviewimages");
  const rows = await col
    .find({})
    .sort({ reviewId: 1, Stt: 1, UploadedAt: 1 })
    .toArray();

  const byReview = new Map();
  for (const row of rows) {
    const key = String(row.reviewId);
    if (!byReview.has(key)) {
      byReview.set(key, []);
    }
    const url = pickUrl(row.ImageUrl);
    if (url) {
      byReview.get(key).push(url);
    }
  }

  let updated = 0;
  for (const [reviewId, urls] of byReview.entries()) {
    const images = normalizeEmbeddedImages(urls, MAX_IMAGES);
    const result = await Review.updateOne(
      {
        _id: new mongoose.Types.ObjectId(reviewId),
        $or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
      },
      { $set: { images } }
    );
    if (result.modifiedCount) {
      updated += 1;
    }
  }

  console.log(
    `Review: merged ${rows.length} ReviewImage rows into ${byReview.size} reviews (${updated} updated)`
  );
  return updated;
}

async function migrateReportImages() {
  const col = mongoose.connection.collection("reportimages");
  const rows = await col
    .find({})
    .sort({ reportId: 1, CreatedAt: 1 })
    .toArray();

  const byReport = new Map();
  for (const row of rows) {
    const key = String(row.reportId);
    if (!key || key === "undefined" || key === "null") {
      continue;
    }
    if (!byReport.has(key)) {
      byReport.set(key, []);
    }
    const url = pickUrl(row.imageUrl || row.ImageUrl);
    if (url) {
      byReport.get(key).push(url);
    }
  }

  let updated = 0;
  for (const [reportId, urls] of byReport.entries()) {
    const images = normalizeEmbeddedImages(urls, MAX_IMAGES);
    const result = await Report.updateOne(
      {
        _id: new mongoose.Types.ObjectId(reportId),
        $or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
      },
      { $set: { images } }
    );
    if (result.modifiedCount) {
      updated += 1;
    }
  }

  console.log(
    `Report: merged ${rows.length} ReportImage rows into ${byReport.size} reports (${updated} updated)`
  );
  return updated;
}

async function run() {
  await connectDB();
  const total =
    (await migrateProductImages()) +
    (await migrateReviewImages()) +
    (await migrateReportImages());
  console.log(`Done. Total parent documents updated: ${total}`);
  console.log(
    "Optional cleanup after verifying data: db.productimages.drop(); db.reviewimages.drop(); db.reportimages.drop();"
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

require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), override: false });

const { mongoUri } = require("../config/env");
const mongoose = require("mongoose");
const Report = require("../models/Report");
const ReportImage = require("../models/ReportImage");

const SEED_TAG = "seed-report-demo";

const FIXED_URLS = [
  "https://picsum.photos/seed/fastmark-evidence-1/640/480",
  "https://picsum.photos/seed/fastmark-evidence-2/640/480",
];

async function fixReportImageUrls() {
  if (!mongoUri) {
    throw new Error("Thiếu MONGO_URI trong .env");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  const seedReports = await Report.find({ content: { $regex: SEED_TAG } })
    .select("_id")
    .lean();
  const reportIds = seedReports.map((report) => report._id);

  const images = await ReportImage.find({ reportId: { $in: reportIds } }).sort({ CreatedAt: 1 });
  let updated = 0;

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const nextUrl = FIXED_URLS[index % FIXED_URLS.length];
    if (image.imageUrl !== nextUrl) {
      image.imageUrl = nextUrl;
      image.UpdatedAt = new Date();
      await image.save();
      updated += 1;
    }
  }

  console.log(`Đã cập nhật ${updated}/${images.length} ảnh bằng chứng demo sang picsum.photos.`);
  await mongoose.disconnect();
}

fixReportImageUrls().catch(async (error) => {
  console.error("Fix report images failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

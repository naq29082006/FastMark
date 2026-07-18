const mongoose = require("mongoose");

const { mongoUri } = require("./env");
const { syncProductCollectionIndexes } = require("./syncProductIndexes");
const { syncReviewCollectionIndexes } = require("./syncReviewIndexes");
const { migrateUnifiedReviews } = require("./migrateUnifiedReviews");

const connectDB = async () => {
  try {
    console.log("Connecting MongoDB...");
    await mongoose.connect(mongoUri);
    await syncProductCollectionIndexes(mongoose.connection);
    await syncReviewCollectionIndexes(mongoose.connection);
    const reviewMigration = await migrateUnifiedReviews(mongoose.connection);
    if (!reviewMigration?.skipped) {
      console.log("Unified reviews migration:", reviewMigration);
    }
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("Mongo Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;

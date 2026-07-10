require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });

const mongoose = require("mongoose");
const { syncProductCollectionIndexes } = require("../config/syncProductIndexes");

async function migrate() {
  if (!process.env.MONGO_URI) {
    throw new Error("Thiếu MONGO_URI trong .env ở thư mục gốc dự án");
  }

  await mongoose.connect(process.env.MONGO_URI);
  await syncProductCollectionIndexes(mongoose.connection);
  console.log("Product indexes migrated successfully.");
  await mongoose.disconnect();
}

migrate().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});

const mongoose = require("mongoose");

const { mongoUri } = require("./env");
const { syncProductCollectionIndexes } = require("./syncProductIndexes");

const connectDB = async () => {
  try {
    console.log("Connecting MongoDB...");
    await mongoose.connect(mongoUri);
    await syncProductCollectionIndexes(mongoose.connection);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("Mongo Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;

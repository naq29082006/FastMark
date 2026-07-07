const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('[MongoDB] Thiếu MONGO_URI trong backend/.env');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[MongoDB] Connected');
  } catch (error) {
    console.error('[MongoDB] Error:', error.message);
  }
};

module.exports = connectDB;
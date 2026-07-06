const mongoose = require("mongoose");

const connectDB = async () => {
    console.log("connectDB called");

    try {
        console.log("Connecting MongoDB...");

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB Connected");
    }
    catch (error) {
        console.log("Mongo Error:", error.message);
    }
};

module.exports = connectDB;
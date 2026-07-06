require("dotenv").config();
console.log("MONGO_URI =", process.env.MONGO_URI);
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("FastMark Backend Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
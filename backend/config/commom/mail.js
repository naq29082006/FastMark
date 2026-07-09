const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "naq29082006@gmail.com",       // Gmail
    pass: "uing rqqj tsah pumu"          // App Password 16 ký tự
  }
});

// Export đúng object transporter
module.exports = transporter;
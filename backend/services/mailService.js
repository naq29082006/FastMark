const nodemailer = require("nodemailer");

const {
  smtpUser,
  smtpPass,
  smtpFrom,
  smtpService,
} = require("../config/env");

function isMailConfigured() {
  return Boolean(smtpUser && smtpPass);
}

function getTransporter() {
  if (!isMailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    service: smtpService || "gmail",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

async function sendVerificationEmail({ to, code, expiresInMinutes = 5 }) {
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("SMTP chưa cấu hình. Không thể gửi email xác minh.");
  }

  const from = smtpFrom || smtpUser;

  await transporter.sendMail({
    from: `FastMark <${from}>`,
    to,
    subject: "Mã xác minh email FastMark",
    text: [
      "Xin chào,",
      "",
      `Mã xác minh email của bạn là: ${code}`,
      `Mã có hiệu lực trong ${expiresInMinutes} phút.`,
      "",
      "Nếu bạn không yêu cầu mã này, hãy bỏ qua email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="color:#0f766e">Xác minh email FastMark</h2>
        <p>Mã xác minh của bạn:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#0f766e">${code}</p>
        <p>Mã hết hạn sau <strong>${expiresInMinutes} phút</strong>.</p>
        <p style="color:#64748b;font-size:13px">Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p>
      </div>
    `,
  }).catch((error) => {
    if (error.code === "EAUTH") {
      throw new Error(
        "Gmail từ chối đăng nhập SMTP. Tạo lại App Password (16 ký tự) trong Google Account → Bảo mật → Mật khẩu ứng dụng."
      );
    }
    throw error;
  });

  return true;
}

async function sendPasswordResetEmail({ to, code, expiresInMinutes = 5 }) {
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("SMTP chưa cấu hình. Không thể gửi email đặt lại mật khẩu.");
  }

  const from = smtpFrom || smtpUser;

  await transporter.sendMail({
    from: `FastMark <${from}>`,
    to,
    subject: "Mã OTP đặt lại mật khẩu FastMark",
    text: [
      "Xin chào,",
      "",
      `Mã OTP đặt lại mật khẩu của bạn là: ${code}`,
      `Mã có hiệu lực trong ${expiresInMinutes} phút.`,
      "",
      "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="color:#0f766e">Đặt lại mật khẩu FastMark</h2>
        <p>Mã OTP của bạn:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#0f766e">${code}</p>
        <p>Mã hết hạn sau <strong>${expiresInMinutes} phút</strong>.</p>
        <p style="color:#64748b;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua email.</p>
      </div>
    `,
  }).catch((error) => {
    if (error.code === "EAUTH") {
      throw new Error(
        "Gmail từ chối đăng nhập SMTP. Tạo lại App Password trong Google Account."
      );
    }
    throw error;
  });

  return true;
}

async function sendSellerPhoneCodeEmail({ to, phone, code, expiresInMinutes = 5 }) {
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("SMTP chưa cấu hình. Không thể gửi mã xác minh số điện thoại.");
  }

  const from = smtpFrom || smtpUser;
  const maskedPhone = String(phone || "").replace(/(\d{3})\d{4}(\d{3})/, "$1****$2");

  await transporter.sendMail({
    from: `FastMark <${from}>`,
    to,
    subject: "Mã xác minh số điện thoại FastMark",
    text: [
      "Xin chào,",
      "",
      `Mã xác minh số điện thoại ${maskedPhone} của bạn là: ${code}`,
      `Mã có hiệu lực trong ${expiresInMinutes} phút.`,
      "",
      "Nếu bạn không yêu cầu mã này, hãy bỏ qua email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="color:#0f766e">Xác minh số điện thoại FastMark</h2>
        <p>Mã xác minh cho số <strong>${maskedPhone}</strong>:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#0f766e">${code}</p>
        <p>Mã hết hạn sau <strong>${expiresInMinutes} phút</strong>.</p>
      </div>
    `,
  });

  return true;
}

module.exports = {
  isMailConfigured,
  getTransporter,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSellerPhoneCodeEmail,
};

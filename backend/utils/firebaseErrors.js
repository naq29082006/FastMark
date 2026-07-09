function mapFirebaseAdminError(error) {
  const code = error?.code || error?.errorInfo?.code || "";

  const messages = {
    "auth/email-already-exists": "Email này đã được sử dụng.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/invalid-password": "Mật khẩu phải có ít nhất 6 ký tự.",
    "auth/user-not-found": "Không tìm thấy tài khoản.",
    "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
    "auth/id-token-expired": "Phiên đăng nhập đã hết hạn.",
    "auth/id-token-revoked": "Phiên đăng nhập đã bị thu hồi.",
    "auth/argument-error": "Token Google không hợp lệ.",
    "auth/invalid-id-token": "Token Google không hợp lệ.",
    "auth/invalid-credential": "Token Google không hợp lệ hoặc đã hết hạn.",
  };

  const message = messages[code] || error?.message || "Xác thực Firebase thất bại.";
  const statusCode =
    code === "auth/email-already-exists" ? 409 :
    code.startsWith("auth/invalid") || code === "auth/argument-error" ? 400 :
    code === "auth/user-not-found" || code === "auth/wrong-password" ? 401 :
    500;

  const mapped = new Error(message);
  mapped.statusCode = statusCode;
  mapped.code = code;
  return mapped;
}

function mapFirebaseRestError(error) {
  const message = error?.error?.message || error?.message || "Đăng nhập thất bại.";

  const mapped = new Error(
    message.includes("API key not valid") || message.includes("API_KEY_INVALID")
      ? "FIREBASE_API_KEY không hợp lệ. Kiểm tra backend/.env (chỉ 1 dấu =) và dùng Web API Key đúng project."
      : message.includes("INVALID_PASSWORD") || message.includes("EMAIL_NOT_FOUND")
      ? "Email hoặc mật khẩu không đúng."
      : message.includes("USER_DISABLED")
        ? "Tài khoản đã bị khóa."
        : message.includes("INVALID_IDP_RESPONSE") ||
            message.includes("FEDERATED_USER_ID_ALREADY_LINKED")
          ? "Token Google không hợp lệ hoặc không khớp project Firebase."
          : message
  );

  mapped.statusCode =
    message.includes("API key not valid") || message.includes("API_KEY_INVALID")
      ? 500
      : 401;
  return mapped;
}

module.exports = {
  mapFirebaseAdminError,
  mapFirebaseRestError,
};

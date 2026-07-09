const authService = require("../services/authService");
const userService = require("../services/userService");
const { buildPublicUserProfile } = require("../services/profileService");
const {
  resolveFileExtension,
  uploadImageToSupabase,
} = require("../services/uploadService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }

  return "";
}

function normalizeUserName(userName) {
  return String(userName || "").trim();
}

function validateUserName(userName) {
  const normalized = normalizeUserName(userName);

  if (!normalized) {
    return "Thiếu userName.";
  }

  if (normalized.length < 3 || normalized.length > 20) {
    return "UserName phải từ 3 đến 20 ký tự.";
  }

  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
    return "UserName chỉ được dùng chữ, số và dấu gạch dưới.";
  }

  return "";
}

exports.registerEmail = async (req, res) => {
  const email = pickBodyValue(req.body, ["email", "Email"]);
  const password = pickBodyValue(req.body, ["password", "Password"]);
  const userName = pickBodyValue(req.body, ["userName", "UserName"]);
  const fullName = pickBodyValue(req.body, ["fullName", "FullName"]);

  if (!email || !password || !userName || !fullName) {
    return fail(res, {
      status: 400,
      message: "Thiếu email, mật khẩu, họ tên hoặc userName.",
    });
  }

  if (fullName.length < 2) {
    return fail(res, {
      status: 400,
      message: "Họ tên phải có ít nhất 2 ký tự.",
    });
  }

  const userNameError = validateUserName(userName);
  if (userNameError) {
    return fail(res, {
      status: 400,
      message: userNameError,
    });
  }

  if (password.length < 6) {
    return fail(res, {
      status: 400,
      message: "Mật khẩu phải có ít nhất 6 ký tự.",
    });
  }

  const result = await authService.registerWithEmail({
    email,
    password,
    fullName,
    userName,
  });

  return success(res, {
    status: 200,
    message: "Đăng ký email thành công.",
    data: {
      user: result.user.toPublicJSON(),
      firebaseUid: result.firebaseUid,
      verification: {
        expiresAt: result.verification.expiresAt,
        expiresInSeconds: result.verification.expiresInSeconds,
        resendAvailableAt: result.verification.resendAvailableAt,
        resendCooldownSeconds: result.verification.resendCooldownSeconds,
      },
    },
  });
};

exports.loginEmail = async (req, res) => {
  const login = pickBodyValue(req.body, ["login", "email", "Email", "userName", "UserName"]);
  const password = pickBodyValue(req.body, ["password", "Password"]);

  if (!login || !password) {
    return fail(res, {
      status: 400,
      message: "Thiếu email/userName hoặc mật khẩu.",
    });
  }

  const result = await authService.loginWithEmail({ login, password });
  const publicUser = await buildPublicUserProfile(result.user);

  return success(res, {
    message: "Đăng nhập email thành công.",
    data: {
      user: publicUser,
      tokens: result.tokens,
    },
  });
};

exports.registerOrLoginGoogle = async (req, res) => {
  const idToken = pickBodyValue(req.body, ["idToken", "token"]);
  const fullName = pickBodyValue(req.body, ["fullName", "FullName"]);
  const userName = pickBodyValue(req.body, ["userName", "UserName"]);

  if (!idToken) {
    return fail(res, {
      status: 400,
      message: "Thiếu idToken từ Google.",
    });
  }

  if (userName) {
    const userNameError = validateUserName(userName);
    if (userNameError) {
      return fail(res, {
        status: 400,
        message: userNameError,
      });
    }
  }

  if (userName && fullName && fullName.length < 2) {
    return fail(res, {
      status: 400,
      message: "Họ tên phải có ít nhất 2 ký tự.",
    });
  }

  const result = await authService.registerOrLoginWithGoogle({
    idToken,
    fullName,
    userName,
  });

  if (result.needsUsername) {
    return success(res, {
      status: 200,
      message: "Cần hoàn thiện thông tin tài khoản Google.",
      data: {
        needsUsername: true,
        email: result.email,
        suggestedFullName: result.fullName,
        picture: result.picture,
      },
    });
  }

  return success(res, {
    status: 200,
    message: result.isNew
      ? "Đăng ký Google thành công."
      : "Đăng nhập Google thành công.",
    data: {
      needsUsername: false,
      user: await buildPublicUserProfile(result.user),
      firebaseUid: result.firebaseUid,
      isNew: result.isNew,
      customToken: result.customToken,
    },
  });
};

exports.requestEmailVerification = async (req, res) => {
  const isResend = Boolean(req.body?.isResend);
  const result = await authService.requestEmailVerification(req.currentUser.FirebaseUID, {
    isResend,
  });

  return success(res, {
    message: "Đã tạo mã xác minh mới.",
    data: {
      email: result.user.Email,
      expiresAt: result.verification.expiresAt,
      expiresInSeconds: result.verification.expiresInSeconds,
      resendAvailableAt: result.verification.resendAvailableAt,
      resendCooldownSeconds: result.verification.resendCooldownSeconds,
    },
  });
};

exports.confirmEmailVerification = async (req, res) => {
  const code = pickBodyValue(req.body, ["code", "verificationCode"]);

  if (!code) {
    return fail(res, {
      status: 400,
      message: "Thiếu mã xác minh.",
    });
  }

  const user = await authService.confirmEmailVerification({
    firebaseUid: req.currentUser.FirebaseUID,
    code,
  });
  const publicUser = await buildPublicUserProfile(user);

  return success(res, {
    message: "Xác minh email thành công.",
    data: {
      user: publicUser,
    },
  });
};

exports.getMe = async (req, res) => {
  const user = await buildPublicUserProfile(req.currentUser);

  return success(res, {
    data: {
      user,
    },
  });
};

exports.updateMe = async (req, res) => {
  const fullName = pickBodyValue(req.body, ["fullName", "FullName"]);
  const phone = pickBodyValue(req.body, ["phone", "Phone"]);
  const hasFullNameField =
    req.body.fullName !== undefined || req.body.FullName !== undefined;
  const hasPhoneField = req.body.phone !== undefined || req.body.Phone !== undefined;

  if (!hasFullNameField && !hasPhoneField) {
    return fail(res, {
      status: 400,
      message: "Không có dữ liệu để cập nhật.",
    });
  }

  const updates = {};
  if (hasFullNameField && fullName) {
    updates.fullName = fullName;
  }
  if (hasPhoneField) {
    updates.phone = phone;
  }

  if (!updates.fullName && !hasPhoneField) {
    return fail(res, {
      status: 400,
      message: "Họ tên không được để trống.",
    });
  }

  const user = await userService.updateUserProfile(req.currentUser, updates);
  const publicUser = await buildPublicUserProfile(user);

  return success(res, {
    message: "Cập nhật hồ sơ thành công.",
    data: {
      user: publicUser,
    },
  });
};

function readAvatarPayload(req) {
  if (req.file?.buffer?.length) {
    return {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    };
  }

  const imageBase64 = pickBodyValue(req.body, ["imageBase64", "base64"]);
  const mimeType = pickBodyValue(req.body, ["mimeType", "contentType"]) || "image/jpeg";

  if (!imageBase64) {
    return null;
  }

  const normalizedBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    const error = new Error("Dữ liệu ảnh base64 không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    const error = new Error("Ảnh không được lớn hơn 5MB.");
    error.statusCode = 400;
    throw error;
  }

  return {
    buffer,
    mimeType,
    originalName: "",
  };
}

exports.uploadAvatar = async (req, res) => {
  const avatarPayload = readAvatarPayload(req);

  if (!avatarPayload) {
    return fail(res, {
      status: 400,
      message: "Thiếu file ảnh đại diện.",
    });
  }

  const extension = resolveFileExtension(avatarPayload.mimeType, avatarPayload.originalName);
  const fileName = `${req.currentUser.FirebaseUID}-${Date.now()}.${extension}`;

  const uploadResult = await uploadImageToSupabase({
    buffer: avatarPayload.buffer,
    mimeType: avatarPayload.mimeType,
    folder: "avatars",
    fileName,
  });

  const user = await userService.updateUserProfile(req.currentUser, {
    avatar: uploadResult.publicUrl,
  });
  const publicUser = await buildPublicUserProfile(user);

  return success(res, {
    message: "Upload ảnh đại diện thành công.",
    data: {
      user: publicUser,
      avatarUrl: uploadResult.publicUrl,
      storagePath: uploadResult.path,
    },
  });
};

exports.uploadCover = async (req, res) => {
  const coverPayload = readAvatarPayload(req);

  if (!coverPayload) {
    return fail(res, {
      status: 400,
      message: "Thiếu file ảnh bìa.",
    });
  }

  const extension = resolveFileExtension(coverPayload.mimeType, coverPayload.originalName);
  const fileName = `${req.currentUser.FirebaseUID}-cover-${Date.now()}.${extension}`;

  const uploadResult = await uploadImageToSupabase({
    buffer: coverPayload.buffer,
    mimeType: coverPayload.mimeType,
    folder: "covers",
    fileName,
  });

  const user = await userService.updateUserProfile(req.currentUser, {
    coverImage: uploadResult.publicUrl,
  });
  const publicUser = await buildPublicUserProfile(user);

  return success(res, {
    message: "Upload ảnh bìa thành công.",
    data: {
      user: publicUser,
      coverImageUrl: uploadResult.publicUrl,
      storagePath: uploadResult.path,
    },
  });
};

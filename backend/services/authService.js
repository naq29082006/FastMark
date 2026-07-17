const { auth } = require("../config/firebaseAdmin");
const { firebaseApiKey } = require("../config/env");
const {
  assertUserNameAvailable,
  createUserRecord,
  findUserByFirebaseUid,
  updateUserActivity,
} = require("./userService");
const {
  mapFirebaseAdminError,
  mapFirebaseRestError,
} = require("../utils/firebaseErrors");
const { sendVerificationEmail, sendPasswordResetEmail } = require("./mailService");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateEmailVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const EMAIL_VERIFY_TTL_MS = 5 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

function buildVerificationMeta(user) {
  const expiresAt = user.EmailVerifyCodeExpiresAt;
  const expiresInSeconds = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : 0;

  let resendAvailableAt = null;
  let resendCooldownSeconds = 0;

  if (user.EmailVerifyResendAt) {
    resendAvailableAt = new Date(user.EmailVerifyResendAt.getTime() + EMAIL_RESEND_COOLDOWN_MS);
    resendCooldownSeconds = Math.max(
      0,
      Math.floor((resendAvailableAt.getTime() - Date.now()) / 1000)
    );
  }

  return {
    expiresAt,
    expiresInSeconds: expiresInSeconds || Math.floor(EMAIL_VERIFY_TTL_MS / 1000),
    resendAvailableAt,
    resendCooldownSeconds,
  };
}

function assertResendCooldown(user) {
  if (!user.EmailVerifyResendAt) {
    return;
  }

  const resendAvailableAt = user.EmailVerifyResendAt.getTime() + EMAIL_RESEND_COOLDOWN_MS;
  const waitMs = resendAvailableAt - Date.now();

  if (waitMs > 0) {
    const waitSeconds = Math.ceil(waitMs / 1000);
    const error = new Error(
      `Vui lòng đợi ${Math.ceil(waitSeconds / 60)} phút trước khi gửi lại mã.`
    );
    error.statusCode = 429;
    error.retryAfterSeconds = waitSeconds;
    throw error;
  }
}

async function assignEmailVerificationCode(
  user,
  { enforceResendCooldown = false, trackResendCooldown = false } = {}
) {
  if (enforceResendCooldown) {
    assertResendCooldown(user);
  }

  const code = generateEmailVerifyCode();
  user.EmailVerifyCode = code;
  user.EmailVerifyCodeExpiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

  if (trackResendCooldown) {
    user.EmailVerifyResendAt = new Date();
  }

  await user.save();

  await sendVerificationEmail({
    to: user.Email,
    code,
    expiresInMinutes: EMAIL_VERIFY_TTL_MS / 60000,
  });

  return buildVerificationMeta(user);
}

function normalizeUserName(userName) {
  return String(userName || "").trim();
}

function buildUserPayload({
  firebaseUid,
  fullName,
  email,
  phone,
  userName,
  avatar,
  authProvider,
  verifyAccount = false,
}) {
  const payload = {
    FirebaseUID: firebaseUid,
    FullName: fullName,
    UserName: normalizeUserName(userName),
    Email: email || "",
    Avatar: avatar || "",
    AuthProvider: authProvider,
    VerifyAccount: verifyAccount,
  };

  if (phone) {
    payload.Phone = phone;
  }

  return payload;
}

async function registerWithEmail({
  email,
  password,
  fullName,
  userName,
}) {
  const normalizedEmail = normalizeEmail(email);
  let firebaseUser;

  try {
    firebaseUser = await auth.createUser({
      email: normalizedEmail,
      password,
      displayName: fullName,
      emailVerified: false,
    });
  } catch (error) {
    throw mapFirebaseAdminError(error);
  }

  try {
    const user = await createUserRecord(
      buildUserPayload({
        firebaseUid: firebaseUser.uid,
        fullName,
        email: normalizedEmail,
        userName,
        authProvider: "email",
      })
    );

    const verification = await assignEmailVerificationCode(user);

    return {
      user,
      firebaseUid: firebaseUser.uid,
      isNew: true,
      verification,
    };
  } catch (error) {
    await auth.deleteUser(firebaseUser.uid).catch(() => {});
    throw error;
  }
}

async function loginWithEmail({ login, email, password }) {
  const loginValue = String(login || email || "").trim();
  const { findUserByUserName, findUserByEmail } = require("./userService");

  if (!loginValue) {
    const error = new Error("Vui lòng nhập email hoặc username.");
    error.statusCode = 400;
    error.code = "LOGIN_MISSING";
    error.field = "login";
    throw error;
  }

  if (!password) {
    const error = new Error("Vui lòng nhập mật khẩu.");
    error.statusCode = 400;
    error.code = "LOGIN_MISSING_PASSWORD";
    error.field = "password";
    throw error;
  }

  if (String(password).length < 6) {
    const error = new Error("Mật khẩu phải có ít nhất 6 ký tự.");
    error.statusCode = 400;
    error.code = "LOGIN_PASSWORD_TOO_SHORT";
    error.field = "password";
    throw error;
  }

  let matchedUser = null;
  let normalizedEmail = "";

  if (loginValue.includes("@")) {
    normalizedEmail = normalizeEmail(loginValue);
    matchedUser = await findUserByEmail(normalizedEmail);
    if (!matchedUser) {
      const error = new Error("Email không tồn tại.");
      error.statusCode = 404;
      error.code = "LOGIN_EMAIL_NOT_FOUND";
      error.field = "login";
      throw error;
    }
  } else {
    matchedUser = await findUserByUserName(loginValue);
    if (!matchedUser?.Email) {
      const error = new Error("Username không tồn tại.");
      error.statusCode = 404;
      error.code = "LOGIN_USER_NOT_FOUND";
      error.field = "login";
      throw error;
    }
    normalizedEmail = normalizeEmail(matchedUser.Email);
  }

  if (String(matchedUser.AuthProvider || "").toLowerCase() === "google") {
    const error = new Error(
      "Tài khoản đăng ký bằng Google chưa tạo mật khẩu. Vui lòng đăng nhập bằng Google."
    );
    error.statusCode = 400;
    error.code = "LOGIN_GOOGLE_NO_PASSWORD";
    error.field = "password";
    throw error;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        returnSecureToken: true,
      }),
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw mapFirebaseRestError(payload);
  }

  let user = await findUserByFirebaseUid(payload.localId);

  if (!user) {
    user = matchedUser;
  }

  const { assertUserIsActive } = require("./adminAccountService");
  assertUserIsActive(user);

  await updateUserActivity(user);

  const customToken = await auth.createCustomToken(payload.localId);

  return {
    user,
    tokens: {
      idToken: payload.idToken,
      refreshToken: payload.refreshToken,
      customToken,
      expiresIn: payload.expiresIn,
    },
  };
}

async function exchangeGoogleIdTokenForFirebase(googleIdToken) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
        requestUri: "http://localhost",
        returnSecureToken: true,
      }),
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw mapFirebaseRestError(payload);
  }

  return payload;
}

async function resolveGoogleAuthIdentity(idToken) {
  try {
    const decoded = await auth.verifyIdToken(idToken);

    if (decoded.firebase?.sign_in_provider === "google.com") {
      return {
        firebaseUid: decoded.uid,
        email: decoded.email || "",
        googleFullName: decoded.name || "",
        picture: decoded.picture || "",
        emailVerified: Boolean(decoded.email_verified),
      };
    }
  } catch (error) {
    const code = error?.code || error?.errorInfo?.code || "";

    if (code && code !== "auth/argument-error" && code !== "auth/invalid-id-token") {
      throw mapFirebaseAdminError(error);
    }
  }

  const session = await exchangeGoogleIdTokenForFirebase(idToken);

  return {
    firebaseUid: session.localId,
    email: session.email || "",
    googleFullName: session.displayName || "",
    picture: session.photoUrl || "",
    emailVerified: true,
  };
}

async function registerOrLoginWithGoogle({ idToken, fullName, userName }) {
  const identity = await resolveGoogleAuthIdentity(idToken);
  const { ensureDefaultUserAvatar } = require("./defaultUserAvatarService");

  let user = await findUserByFirebaseUid(identity.firebaseUid);
  let isNew = false;

  if (!user) {
    if (!normalizeUserName(userName)) {
      return {
        needsUsername: true,
        email: identity.email,
        fullName: fullName || identity.googleFullName || "",
        // Không trả ảnh Google — avatar hệ thống sẽ tạo sau khi hoàn tất đăng ký.
        picture: "",
        firebaseUid: identity.firebaseUid,
      };
    }

    if (!fullName && !identity.googleFullName) {
      const error = new Error("Thiếu họ tên khi đăng ký Google lần đầu.");
      error.statusCode = 400;
      throw error;
    }

    user = await createUserRecord(
      buildUserPayload({
        firebaseUid: identity.firebaseUid,
        fullName: fullName || identity.googleFullName || "Người dùng Google",
        email: identity.email,
        userName,
        avatar: "",
        authProvider: "google",
        verifyAccount: identity.emailVerified,
      })
    );
    isNew = true;
    await ensureDefaultUserAvatar(user);
  } else {
    const { assertUserIsActive } = require("./adminAccountService");
    assertUserIsActive(user);

    if (fullName) user.FullName = fullName;
    if (userName) {
      user.UserName = await assertUserNameAvailable(userName, {
        excludeUserId: user._id,
      });
    }
    // Không ghi đè Avatar bằng ảnh Google. Chỉ tạo avatar hệ thống nếu chưa có.
    await user.save();
    await ensureDefaultUserAvatar(user);
  }

  await updateUserActivity(user);

  const customToken = await auth.createCustomToken(identity.firebaseUid);

  return {
    user,
    isNew,
    firebaseUid: identity.firebaseUid,
    needsUsername: false,
    customToken,
  };
}

async function getUserFromToken(idToken) {
  let decoded;

  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch (error) {
    throw mapFirebaseAdminError(error);
  }

  const user = await findUserByFirebaseUid(decoded.uid);

  if (!user) {
    const error = new Error("Chưa có hồ sơ người dùng trên hệ thống.");
    error.statusCode = 404;
    throw error;
  }

  return user;
}

async function requestEmailVerification(firebaseUid, { isResend = false } = {}) {
  const user = await findUserByFirebaseUid(firebaseUid);

  if (!user) {
    const error = new Error("Không tìm thấy tài khoản.");
    error.statusCode = 404;
    throw error;
  }

  if (user.AuthProvider !== "email") {
    const error = new Error("Tài khoản này không cần xác minh email.");
    error.statusCode = 400;
    throw error;
  }

  if (user.VerifyAccount) {
    const error = new Error("Email đã được xác minh.");
    error.statusCode = 400;
    throw error;
  }

  const verification = await assignEmailVerificationCode(user, {
    enforceResendCooldown: isResend,
    trackResendCooldown: isResend,
  });

  return {
    user,
    verification,
  };
}

async function confirmEmailVerification({ firebaseUid, code }) {
  const user = await findUserByFirebaseUid(firebaseUid);

  if (!user) {
    const error = new Error("Không tìm thấy tài khoản.");
    error.statusCode = 404;
    throw error;
  }

  if (user.VerifyAccount) {
    const error = new Error("Email đã được xác minh.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedCode = String(code || "").trim();

  if (!normalizedCode) {
    const error = new Error("Thiếu mã xác minh.");
    error.statusCode = 400;
    throw error;
  }

  if (!user.EmailVerifyCode || user.EmailVerifyCode !== normalizedCode) {
    const error = new Error("Mã xác minh không đúng.");
    error.statusCode = 400;
    throw error;
  }

  if (!user.EmailVerifyCodeExpiresAt || new Date() > user.EmailVerifyCodeExpiresAt) {
    const error = new Error("Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.");
    error.statusCode = 400;
    throw error;
  }

  user.VerifyAccount = true;
  user.EmailVerifyCode = null;
  user.EmailVerifyCodeExpiresAt = null;
  await user.save();

  return user;
}

const PASSWORD_RESET_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 3 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_SESSION_TTL_MS = 10 * 60 * 1000;

const passwordResetAttempts = new Map();
const passwordResetSessions = new Map();

function buildPasswordResetMeta(user) {
  const expiresAt = user.EmailVerifyCodeExpiresAt;
  const expiresInSeconds = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : 0;

  let resendCooldownSeconds = 0;
  if (user.EmailVerifyResendAt) {
    const resendAvailableAt = user.EmailVerifyResendAt.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS;
    resendCooldownSeconds = Math.max(0, Math.floor((resendAvailableAt - Date.now()) / 1000));
  }

  return {
    expiresInSeconds: expiresInSeconds || Math.floor(PASSWORD_RESET_TTL_MS / 1000),
    resendCooldownSeconds,
  };
}

function getResetAttemptState(email) {
  const state = passwordResetAttempts.get(email);
  if (!state) {
    return { count: 0, lockedUntil: 0 };
  }
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return state;
  }
  if (state.lockedUntil && Date.now() >= state.lockedUntil) {
    passwordResetAttempts.delete(email);
    return { count: 0, lockedUntil: 0 };
  }
  return state;
}

function recordFailedResetAttempt(email) {
  const state = getResetAttemptState(email);
  const count = (state.count || 0) + 1;
  if (count >= PASSWORD_RESET_MAX_ATTEMPTS) {
    passwordResetAttempts.set(email, {
      count,
      lockedUntil: Date.now() + PASSWORD_RESET_TTL_MS,
    });
    return;
  }
  passwordResetAttempts.set(email, { count, lockedUntil: 0 });
}

async function requestPasswordReset({ email }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const error = new Error("Thiếu email.");
    error.statusCode = 400;
    throw error;
  }

  const { findUserByEmail } = require("./userService");
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    const error = new Error("Không tìm thấy tài khoản với email này.");
    error.statusCode = 404;
    throw error;
  }

  if (user.AuthProvider !== "email") {
    const error = new Error("Tài khoản đăng nhập Google không thể đặt lại mật khẩu qua email.");
    error.statusCode = 400;
    throw error;
  }

  assertResendCooldown(user);

  const code = generateEmailVerifyCode();
  user.EmailVerifyCode = code;
  user.EmailVerifyCodeExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  user.EmailVerifyResendAt = new Date();
  await user.save();

  passwordResetAttempts.delete(normalizedEmail);
  passwordResetSessions.delete(normalizedEmail);

  await sendPasswordResetEmail({
    to: normalizedEmail,
    code,
    expiresInMinutes: PASSWORD_RESET_TTL_MS / 60000,
  });

  return buildPasswordResetMeta(user);
}

async function verifyPasswordResetOtp({ email, code }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code || "").trim();

  if (!normalizedEmail || !normalizedCode) {
    const error = new Error("Thiếu email hoặc mã OTP.");
    error.statusCode = 400;
    throw error;
  }

  const attemptState = getResetAttemptState(normalizedEmail);
  if (attemptState.lockedUntil && Date.now() < attemptState.lockedUntil) {
    const waitSeconds = Math.ceil((attemptState.lockedUntil - Date.now()) / 1000);
    const error = new Error(`Đã nhập sai quá nhiều lần. Thử lại sau ${waitSeconds} giây.`);
    error.statusCode = 429;
    throw error;
  }

  const { findUserByEmail } = require("./userService");
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    const error = new Error("Không tìm thấy tài khoản.");
    error.statusCode = 404;
    throw error;
  }

  if (!user.EmailVerifyCode || user.EmailVerifyCode !== normalizedCode) {
    recordFailedResetAttempt(normalizedEmail);
    const error = new Error("Mã OTP không đúng.");
    error.statusCode = 400;
    throw error;
  }

  if (!user.EmailVerifyCodeExpiresAt || new Date() > user.EmailVerifyCodeExpiresAt) {
    const error = new Error("Mã OTP đã hết hạn. Vui lòng gửi lại.");
    error.statusCode = 400;
    throw error;
  }

  passwordResetAttempts.delete(normalizedEmail);
  const resetToken = `${user._id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  passwordResetSessions.set(normalizedEmail, {
    token: resetToken,
    expiresAt: Date.now() + PASSWORD_RESET_SESSION_TTL_MS,
  });

  return {
    resetToken,
    expiresInSeconds: Math.floor(PASSWORD_RESET_SESSION_TTL_MS / 1000),
  };
}

async function resetPasswordWithToken({ email, resetToken, newPassword }) {
  const normalizedEmail = normalizeEmail(email);
  const token = String(resetToken || "").trim();

  if (!normalizedEmail || !token) {
    const error = new Error("Thiếu thông tin đặt lại mật khẩu.");
    error.statusCode = 400;
    throw error;
  }

  if (!newPassword || String(newPassword).length < 6) {
    const error = new Error("Mật khẩu phải có ít nhất 6 ký tự.");
    error.statusCode = 400;
    throw error;
  }

  const session = passwordResetSessions.get(normalizedEmail);
  if (!session || session.token !== token || Date.now() > session.expiresAt) {
    const error = new Error("Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
    error.statusCode = 400;
    throw error;
  }

  const { findUserByEmail } = require("./userService");
  const user = await findUserByEmail(normalizedEmail);

  if (!user?.FirebaseUID) {
    const error = new Error("Không tìm thấy tài khoản.");
    error.statusCode = 404;
    throw error;
  }

  try {
    await auth.updateUser(user.FirebaseUID, { password: newPassword });
    await auth.revokeRefreshTokens(user.FirebaseUID);
  } catch (error) {
    throw mapFirebaseAdminError(error);
  }

  user.EmailVerifyCode = null;
  user.EmailVerifyCodeExpiresAt = null;
  user.UpdatedAt = new Date();
  await user.save();

  passwordResetSessions.delete(normalizedEmail);
  passwordResetAttempts.delete(normalizedEmail);

  return { success: true };
}

module.exports = {
  registerWithEmail,
  loginWithEmail,
  registerOrLoginWithGoogle,
  getUserFromToken,
  requestEmailVerification,
  confirmEmailVerification,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
};

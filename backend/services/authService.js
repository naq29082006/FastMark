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
const {
  OTP_PURPOSE,
  getOtpSession,
  setOtpSession,
  clearOtpSession,
  bumpOtpFailCount,
} = require("./otpSessionStore");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateEmailVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const EMAIL_VERIFY_TTL_MS = 5 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFY_MAX_ATTEMPTS = 5;

function buildVerificationMeta(session) {
  const expiresAt = session?.expiresAt ? new Date(session.expiresAt) : null;
  const expiresInSeconds = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : Math.floor(EMAIL_VERIFY_TTL_MS / 1000);

  let resendAvailableAt = null;
  let resendCooldownSeconds = 0;

  if (session?.resendAt) {
    resendAvailableAt = new Date(new Date(session.resendAt).getTime() + EMAIL_RESEND_COOLDOWN_MS);
    resendCooldownSeconds = Math.max(
      0,
      Math.floor((resendAvailableAt.getTime() - Date.now()) / 1000)
    );
  }

  return {
    expiresAt,
    expiresInSeconds,
    resendAvailableAt,
    resendCooldownSeconds,
    remainingSeconds: resendCooldownSeconds,
  };
}

function assertResendCooldown(session, cooldownMs = EMAIL_RESEND_COOLDOWN_MS) {
  if (!session?.resendAt) {
    return;
  }

  const resendAvailableAt = new Date(session.resendAt).getTime() + cooldownMs;
  const waitMs = resendAvailableAt - Date.now();

  if (waitMs > 0) {
    const waitSeconds = Math.ceil(waitMs / 1000);
    const resendAvailableAtIso = new Date(resendAvailableAt).toISOString();
    const error = new Error(
      `Vui lòng chờ ${waitSeconds} giây trước khi gửi lại mã.`
    );
    error.statusCode = 429;
    error.retryAfterSeconds = waitSeconds;
    error.data = {
      resendAvailableAt: resendAvailableAtIso,
      resendCooldownSeconds: waitSeconds,
      remainingSeconds: waitSeconds,
    };
    throw error;
  }
}

async function assignEmailVerificationCode(
  user,
  { enforceResendCooldown = false, trackResendCooldown = false } = {}
) {
  const existing = getOtpSession(OTP_PURPOSE.EMAIL_VERIFY, user._id);
  if (enforceResendCooldown) {
    assertResendCooldown(existing);
  }

  const code = generateEmailVerifyCode();
  const now = Date.now();
  const session = setOtpSession(OTP_PURPOSE.EMAIL_VERIFY, user._id, {
    target: user.Email || "",
    code,
    expiresAt: new Date(now + EMAIL_VERIFY_TTL_MS),
    // Gửi / gửi lại thủ công + auto sau sai 5 lần: khóa gửi lại 2 phút.
    resendAt: trackResendCooldown ? new Date(now) : null,
    failCount: 0,
  });

  await sendVerificationEmail({
    to: user.Email,
    code,
    expiresInMinutes: EMAIL_VERIFY_TTL_MS / 60000,
  });

  return buildVerificationMeta(session);
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

    const verification = await assignEmailVerificationCode(user, {
      enforceResendCooldown: false,
      trackResendCooldown: true,
    });

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

  // Cho phép đăng nhập khi bị khóa để vào màn khiếu nại (Status=0).
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
    // Cho phép đăng nhập Google khi bị khóa để vào màn khiếu nại.

    // Không ghi đè tên người dùng đã có bằng tên mặc định từ Google mỗi lần đăng nhập.
    // Chỉ backfill khi tài khoản chưa có FullName.
    if (fullName && !String(user.FullName || "").trim()) {
      user.FullName = fullName;
    }
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
    enforceResendCooldown: isResend || Boolean(getOtpSession(OTP_PURPOSE.EMAIL_VERIFY, user._id)),
    trackResendCooldown: true,
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

  const session = getOtpSession(OTP_PURPOSE.EMAIL_VERIFY, user._id);
  if (!session?.code) {
    const error = new Error("Chưa có mã xác minh. Vui lòng gửi mã trước.");
    error.statusCode = 400;
    throw error;
  }

  if (!session.expiresAt || new Date() > new Date(session.expiresAt)) {
    clearOtpSession(OTP_PURPOSE.EMAIL_VERIFY, user._id);
    const error = new Error("Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.");
    error.statusCode = 400;
    throw error;
  }

  if (session.code !== normalizedCode) {
    const updated = bumpOtpFailCount(OTP_PURPOSE.EMAIL_VERIFY, user._id) || session;
    const failCount = Number(updated.failCount) || 0;
    if (failCount >= EMAIL_VERIFY_MAX_ATTEMPTS) {
      // Sai 5 lần → gửi mã mới + khóa gửi lại 2 phút.
      const meta = await assignEmailVerificationCode(user, {
        enforceResendCooldown: false,
        trackResendCooldown: true,
      });
      const error = new Error(
        "Bạn đã nhập sai 5 lần. Hệ thống đã gửi mã mới — vui lòng nhập mã mới. Có thể gửi lại sau 2 phút."
      );
      error.statusCode = 400;
      error.data = { mustUseNewCode: true, email: user.Email, ...meta };
      throw error;
    }
    const error = new Error(
      `Mã xác minh không đúng. Còn ${EMAIL_VERIFY_MAX_ATTEMPTS - failCount} lần thử.`
    );
    error.statusCode = 400;
    throw error;
  }

  user.VerifyAccount = true;
  await user.save();
  clearOtpSession(OTP_PURPOSE.EMAIL_VERIFY, user._id);

  return user;
}

const PASSWORD_RESET_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_SESSION_TTL_MS = 10 * 60 * 1000;

const passwordResetSessions = new Map();

function buildPasswordResetMeta(session) {
  const expiresAt = session?.expiresAt ? new Date(session.expiresAt) : null;
  const expiresInSeconds = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : Math.floor(PASSWORD_RESET_TTL_MS / 1000);

  let resendAvailableAt = null;
  let resendCooldownSeconds = 0;
  if (session?.resendAt) {
    resendAvailableAt = new Date(
      new Date(session.resendAt).getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS
    );
    resendCooldownSeconds = Math.max(
      0,
      Math.floor((resendAvailableAt.getTime() - Date.now()) / 1000)
    );
  }

  return {
    expiresAt,
    expiresInSeconds,
    resendAvailableAt,
    resendCooldownSeconds,
    remainingSeconds: resendCooldownSeconds,
  };
}

async function issuePasswordResetCode(user, normalizedEmail, { enforceCooldown = true } = {}) {
  if (enforceCooldown) {
    assertResendCooldown(
      getOtpSession(OTP_PURPOSE.PASSWORD_RESET, user._id),
      PASSWORD_RESET_RESEND_COOLDOWN_MS
    );
  }

  const code = generateEmailVerifyCode();
  const now = Date.now();
  const session = setOtpSession(OTP_PURPOSE.PASSWORD_RESET, user._id, {
    target: normalizedEmail,
    code,
    expiresAt: new Date(now + PASSWORD_RESET_TTL_MS),
    resendAt: new Date(now),
    failCount: 0,
  });

  await sendPasswordResetEmail({
    to: normalizedEmail,
    code,
    expiresInMinutes: PASSWORD_RESET_TTL_MS / 60000,
  });

  return buildPasswordResetMeta(session);
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

  passwordResetSessions.delete(normalizedEmail);
  return issuePasswordResetCode(user, normalizedEmail, { enforceCooldown: true });
}

async function requestPasswordResetForUser(user) {
  if (!user) {
    const error = new Error("Không tìm thấy tài khoản.");
    error.statusCode = 401;
    throw error;
  }

  if (user.AuthProvider !== "email") {
    const error = new Error("Tài khoản đăng nhập Google không thể đặt lại mật khẩu qua email.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = normalizeEmail(user.Email);
  if (!normalizedEmail) {
    const error = new Error("Tài khoản chưa có email.");
    error.statusCode = 400;
    throw error;
  }

  passwordResetSessions.delete(normalizedEmail);
  const verification = await issuePasswordResetCode(user, normalizedEmail, {
    enforceCooldown: true,
  });

  return {
    email: normalizedEmail,
    verification,
  };
}

async function verifyPasswordResetOtp({ email, code }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code || "").trim();

  if (!normalizedEmail || !normalizedCode) {
    const error = new Error("Thiếu email hoặc mã OTP.");
    error.statusCode = 400;
    throw error;
  }

  const { findUserByEmail } = require("./userService");
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    const error = new Error("Không tìm thấy tài khoản.");
    error.statusCode = 404;
    throw error;
  }

  const otpSession = getOtpSession(OTP_PURPOSE.PASSWORD_RESET, user._id);
  if (!otpSession?.code) {
    const error = new Error("Chưa có mã OTP. Vui lòng gửi mã trước.");
    error.statusCode = 400;
    throw error;
  }

  if (!otpSession.expiresAt || new Date() > new Date(otpSession.expiresAt)) {
    clearOtpSession(OTP_PURPOSE.PASSWORD_RESET, user._id);
    const error = new Error("Mã OTP đã hết hạn. Vui lòng gửi lại.");
    error.statusCode = 400;
    throw error;
  }

  if (otpSession.code !== normalizedCode) {
    const updated = bumpOtpFailCount(OTP_PURPOSE.PASSWORD_RESET, user._id) || otpSession;
    const failCount = Number(updated.failCount) || 0;

    if (failCount >= PASSWORD_RESET_MAX_ATTEMPTS) {
      const meta = await issuePasswordResetCode(user, normalizedEmail, {
        enforceCooldown: false,
      });
      const error = new Error(
        "Bạn đã nhập sai 5 lần. Hệ thống đã gửi mã mới — vui lòng nhập mã mới. Có thể gửi lại sau 2 phút."
      );
      error.statusCode = 400;
      error.data = { mustUseNewCode: true, email: normalizedEmail, ...meta };
      throw error;
    }

    const error = new Error(
      `Mã OTP không đúng. Còn ${PASSWORD_RESET_MAX_ATTEMPTS - failCount} lần thử.`
    );
    error.statusCode = 400;
    throw error;
  }

  clearOtpSession(OTP_PURPOSE.PASSWORD_RESET, user._id);
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

  clearOtpSession(OTP_PURPOSE.PASSWORD_RESET, user._id);
  passwordResetSessions.delete(normalizedEmail);

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
  requestPasswordResetForUser,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
};

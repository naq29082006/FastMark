const { auth } = require("../config/firebaseAdmin");
const { firebaseApiKey } = require("../config/env");
const {
  createUserRecord,
  findUserByFirebaseUid,
  updateUserActivity,
} = require("./userService");
const {
  mapFirebaseAdminError,
  mapFirebaseRestError,
} = require("../utils/firebaseErrors");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateEmailVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const EMAIL_VERIFY_TTL_MS = 5 * 60 * 1000;

async function assignEmailVerificationCode(user) {
  const code = generateEmailVerifyCode();
  user.EmailVerifyCode = code;
  user.EmailVerifyCodeExpiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
  await user.save();

  return {
    code,
    expiresAt: user.EmailVerifyCodeExpiresAt,
    expiresInSeconds: EMAIL_VERIFY_TTL_MS / 1000,
  };
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
  const loginValue = login || email;
  let normalizedEmail = normalizeEmail(loginValue);

  if (!String(loginValue).includes("@")) {
    const { findUserByUserName } = require("./userService");
    const matchedUser = await findUserByUserName(loginValue);

    if (!matchedUser?.Email) {
      const error = new Error("Không tìm thấy tài khoản với userName này.");
      error.statusCode = 404;
      throw error;
    }

    normalizedEmail = normalizeEmail(matchedUser.Email);
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
    const fallbackUserName = normalizedEmail.split("@")[0].slice(0, 20);

    user = await createUserRecord(
      buildUserPayload({
        firebaseUid: payload.localId,
        fullName: payload.displayName || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        userName: fallbackUserName,
        authProvider: "email",
        verifyAccount: payload.registered || false,
      })
    );
  }

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

  let user = await findUserByFirebaseUid(identity.firebaseUid);
  let isNew = false;

  if (!user) {
    if (!normalizeUserName(userName)) {
      return {
        needsUsername: true,
        email: identity.email,
        fullName: fullName || identity.googleFullName || "",
        picture: identity.picture,
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
        avatar: identity.picture,
        authProvider: "google",
        verifyAccount: identity.emailVerified,
      })
    );
    isNew = true;
  } else {
    if (fullName) user.FullName = fullName;
    if (userName) user.UserName = normalizeUserName(userName);
    if (identity.picture) user.Avatar = identity.picture;
    await user.save();
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

async function requestEmailVerification(firebaseUid) {
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

  const verification = await assignEmailVerificationCode(user);

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

module.exports = {
  registerWithEmail,
  loginWithEmail,
  registerOrLoginWithGoogle,
  getUserFromToken,
  requestEmailVerification,
  confirmEmailVerification,
};

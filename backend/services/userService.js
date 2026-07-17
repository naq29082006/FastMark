const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findUserByFirebaseUid(firebaseUid) {
  return User.findOne({ FirebaseUID: firebaseUid });
}

async function findUserByUserName(userName) {
  const value = String(userName || "").trim();
  if (!value) {
    return null;
  }
  return User.findOne({
    UserName: { $regex: `^${escapeRegex(value)}$`, $options: "i" },
  });
}

async function findShopByUsername(userName) {
  const value = String(userName || "").trim().toLowerCase();
  if (!value) {
    return null;
  }
  return ShopProfile.findOne({
    shopUsername: { $regex: `^${escapeRegex(value)}$`, $options: "i" },
  });
}

async function assertUserNameAvailable(userName, { excludeUserId } = {}) {
  const value = String(userName || "").trim();
  if (!value) {
    const error = new Error("Thiếu userName.");
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await User.findOne({
    UserName: { $regex: `^${escapeRegex(value)}$`, $options: "i" },
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  }).lean();
  if (existingUser) {
    const error = new Error("UserName đã được sử dụng.");
    error.statusCode = 409;
    throw error;
  }

  const existingShop = await findShopByUsername(value);
  if (existingShop) {
    const error = new Error("UserName đã được sử dụng.");
    error.statusCode = 409;
    throw error;
  }

  return value;
}

async function findUserByEmail(email) {
  return User.findOne({ Email: email.toLowerCase().trim() });
}

async function createUserRecord(payload) {
  if (payload?.UserName) {
    await assertUserNameAvailable(payload.UserName);
  }
  return User.create(payload);
}

async function updateUserActivity(user) {
  user.DangHoatDong = true;
  user.LanHoatDongCuoi = new Date();
  await user.save();
  return user;
}

async function updateUserProfile(user, updates = {}) {
  if (updates.phone !== undefined) {
    const error = new Error(
      "Số điện thoại chỉ được cập nhật sau khi xác minh bằng mã OTP."
    );
    error.statusCode = 400;
    throw error;
  }

  if (updates.fullName !== undefined) {
    const fullName = String(updates.fullName).trim();
    if (fullName.length < 2) {
      const error = new Error("Họ tên phải có ít nhất 2 ký tự.");
      error.statusCode = 400;
      throw error;
    }
    user.FullName = fullName;
  }

  if (updates.userName !== undefined) {
    const userName = await assertUserNameAvailable(updates.userName, {
      excludeUserId: user._id,
    });
    user.UserName = userName;
  }

  if (updates.avatar !== undefined) {
    user.Avatar = String(updates.avatar).trim();
  }

  await user.save();
  return user;
}

module.exports = {
  findUserByFirebaseUid,
  findUserByUserName,
  findShopByUsername,
  assertUserNameAvailable,
  findUserByEmail,
  createUserRecord,
  updateUserActivity,
  updateUserProfile,
};

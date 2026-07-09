const User = require("../models/User");

async function findUserByFirebaseUid(firebaseUid) {
  return User.findOne({ FirebaseUID: firebaseUid });
}

async function findUserByUserName(userName) {
  return User.findOne({ UserName: String(userName).trim() });
}

async function findUserByEmail(email) {
  return User.findOne({ Email: email.toLowerCase().trim() });
}

async function createUserRecord(payload) {
  return User.create(payload);
}

async function updateUserActivity(user) {
  user.DangHoatDong = true;
  user.LanHoatDongCuoi = new Date();
  await user.save();
  return user;
}

async function updateUserProfile(user, updates = {}) {
  if (updates.fullName !== undefined) {
    const fullName = String(updates.fullName).trim();
    if (fullName.length < 2) {
      const error = new Error("Họ tên phải có ít nhất 2 ký tự.");
      error.statusCode = 400;
      throw error;
    }
    user.FullName = fullName;
  }

  if (updates.phone !== undefined) {
    const phone = String(updates.phone).trim();
    if (phone && (phone.length !== 10 || !/^\d+$/.test(phone))) {
      const error = new Error("Số điện thoại phải gồm đúng 10 chữ số.");
      error.statusCode = 400;
      throw error;
    }
    user.Phone = phone;
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
  findUserByEmail,
  createUserRecord,
  updateUserActivity,
  updateUserProfile,
};

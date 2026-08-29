const PushDeviceToken = require("../models/PushDeviceToken");
const mongoose = require("mongoose");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function normalizePlatform(platform) {
  const raw = pickString(platform).toLowerCase();
  if (raw === "android" || raw === "ios" || raw === "web") {
    return raw;
  }
  return "unknown";
}

function normalizeUserId(userId) {
  if (!userId) {
    return null;
  }
  if (userId instanceof mongoose.Types.ObjectId) {
    return userId;
  }
  const text = String(userId).trim();
  if (!text || !mongoose.Types.ObjectId.isValid(text)) {
    return null;
  }
  return new mongoose.Types.ObjectId(text);
}

async function registerDeviceToken(userId, { token, platform } = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedToken = pickString(token);
  if (!normalizedUserId) {
    throw createServiceError("Thiếu người dùng.", 400);
  }
  if (!normalizedToken) {
    throw createServiceError("Thiếu device token.", 400);
  }

  const doc = await PushDeviceToken.findOneAndUpdate(
    { token: normalizedToken },
    {
      userId: normalizedUserId,
      token: normalizedToken,
      platform: normalizePlatform(platform),
      UpdatedAt: new Date(),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();

  return {
    id: String(doc._id),
    token: doc.token,
    platform: doc.platform,
    updatedAt: doc.UpdatedAt,
  };
}

async function removeDeviceToken(userId, token) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedToken = pickString(token);
  if (!normalizedUserId || !normalizedToken) {
    return { removed: 0 };
  }

  const result = await PushDeviceToken.deleteOne({
    userId: normalizedUserId,
    token: normalizedToken,
  });

  return { removed: result.deletedCount || 0 };
}

async function listTokensForUser(userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return [];
  }

  const docs = await PushDeviceToken.find({ userId: normalizedUserId })
    .select("token platform UpdatedAt")
    .lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    token: doc.token,
    platform: doc.platform,
    updatedAt: doc.UpdatedAt,
  }));
}

async function removeTokenByValue(token) {
  const normalizedToken = pickString(token);
  if (!normalizedToken) {
    return { removed: 0 };
  }

  const result = await PushDeviceToken.deleteOne({ token: normalizedToken });
  return { removed: result.deletedCount || 0 };
}

module.exports = {
  registerDeviceToken,
  removeDeviceToken,
  listTokensForUser,
  removeTokenByValue,
};

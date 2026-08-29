const { getMessaging } = require("firebase-admin/messaging");
const mongoose = require("mongoose");

const { listTokensForUser, removeTokenByValue } = require("./pushDeviceTokenService");

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

function pickString(value) {
  return String(value || "").trim();
}

function isInvalidTokenError(error) {
  const code = String(error?.code || error?.errorInfo?.code || "");
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

function buildDataPayload(data = {}) {
  const payload = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value == null) {
      return;
    }
    payload[String(key)] = String(value);
  });
  return payload;
}

async function sendPushToUser(userId, { title, content, data } = {}) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await listTokensForUser(normalizedUserId);
  if (!tokens.length) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const messaging = getMessaging();
  const notificationTitle = pickString(title) || "FastMark";
  const notificationBody = pickString(content);
  const dataPayload = buildDataPayload({
    ...data,
    title: notificationTitle,
    content: notificationBody,
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    tokens.map(async (entry) => {
      try {
        await messaging.send({
          token: entry.token,
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          data: dataPayload,
          android: {
            priority: "high",
            notification: {
              channelId: "default",
              sound: "default",
            },
          },
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        if (isInvalidTokenError(error)) {
          await removeTokenByValue(entry.token);
        } else {
          console.warn(
            "[FCM] send failed:",
            entry.token.slice(0, 12),
            error?.message || error
          );
        }
      }
    })
  );

  return { sent, failed, skipped: false };
}

module.exports = {
  sendPushToUser,
};

const { getMessaging } = require("firebase-admin/messaging");
const { app } = require("../config/firebaseAdmin");

function getMessagingClient() {
  try {
    return getMessaging(app);
  } catch (error) {
    console.warn("[FCM] Không khởi tạo được Firebase Messaging:", error.message);
    return null;
  }
}

async function sendPushToTokens(tokens, { title, content } = {}) {
  const normalizedTokens = [...new Set((tokens || []).filter(Boolean))];
  if (!normalizedTokens.length) {
    return { sent: 0, failed: 0 };
  }

  const messaging = getMessagingClient();
  if (!messaging) {
    return { sent: 0, failed: normalizedTokens.length };
  }

  const payload = {
    notification: {
      title: String(title || "").trim(),
      body: String(content || "").trim(),
    },
    data: {
      type: "system_notification",
    },
  };

  let sent = 0;
  let failed = 0;

  await Promise.all(
    normalizedTokens.map(async (token) => {
      try {
        await messaging.send({ token, ...payload });
        sent += 1;
      } catch (error) {
        failed += 1;
        console.warn("[FCM] Gửi thất bại:", error.message);
      }
    })
  );

  return { sent, failed };
}

module.exports = {
  sendPushToTokens,
};

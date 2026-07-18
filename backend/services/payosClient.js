const { PayOS } = require("@payos/node");

let payosClient = null;

function getPayosConfig() {
  return {
    clientId: String(process.env.PAYOS_CLIENT_ID || "").trim(),
    apiKey: String(process.env.PAYOS_API_KEY || "").trim(),
    checksumKey: String(process.env.PAYOS_CHECKSUM_KEY || "").trim(),
  };
}

function assertPayosConfigured() {
  const { clientId, apiKey, checksumKey } = getPayosConfig();
  if (!clientId || !apiKey || !checksumKey) {
    const error = new Error(
      "PayOS chưa được cấu hình. Thêm PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY vào .env."
    );
    error.statusCode = 503;
    throw error;
  }
  return { clientId, apiKey, checksumKey };
}

function getPayosClient() {
  if (payosClient) {
    return payosClient;
  }
  const config = assertPayosConfigured();
  payosClient = new PayOS(config);
  return payosClient;
}

module.exports = {
  getPayosClient,
  assertPayosConfigured,
  getPayosConfig,
};

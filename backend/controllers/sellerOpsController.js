const shopSettingsService = require("../services/shopSettingsService");
const reservationService = require("../services/reservationService");
const sellerReviewService = require("../services/sellerReviewService");
const sellerStatsService = require("../services/sellerStatsService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

exports.getShopSettings = async (req, res) => {
  const settings = await shopSettingsService.getShopSettings(req.currentUser);
  return success(res, { data: { shop: settings } });
};

exports.updateShopSettings = async (req, res) => {
  const settings = await shopSettingsService.updateShopSettings(req.currentUser, req.body);
  return success(res, {
    message: "Đã cập nhật cài đặt cửa hàng.",
    data: { shop: settings },
  });
};

exports.checkShopUsernameAvailability = async (req, res) => {
  const shopUsername =
    pickBodyValue(req.body, ["shopUsername", "username"]) ||
    pickBodyValue(req.query, ["shopUsername", "username"]);

  if (!shopUsername) {
    return fail(res, {
      status: 400,
      message: "Thiếu username shop.",
    });
  }

  const result = await shopSettingsService.checkShopUsernameAvailability(
    req.currentUser,
    shopUsername
  );

  return success(res, {
    data: result,
  });
};

function readShopAvatarPayload(req) {
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

exports.uploadShopAvatar = async (req, res) => {
  const avatarPayload = readShopAvatarPayload(req);

  if (!avatarPayload) {
    return fail(res, {
      status: 400,
      message: "Thiếu file ảnh đại diện gian hàng.",
    });
  }

  const shop = await shopSettingsService.uploadShopAvatar(req.currentUser, avatarPayload);

  return success(res, {
    message: "Upload ảnh gian hàng thành công.",
    data: {
      shop,
      shopAvatar: shop.shopAvatar || "",
      avatarUrl: shop.shopAvatar || "",
    },
  });
};

exports.listOrders = async (req, res) => {
  const tab = req.query.tab || "pending";
  const result = await reservationService.listSellerReservations(req.currentUser, {
    tab,
    search: req.query.search || req.query.q,
    page: req.query.page,
    limit: req.query.limit,
  });
  return success(res, { data: { tab, ...result } });
};

exports.getReservationDetail = async (req, res) => {
  const reservation = await reservationService.getSellerReservationDetail(
    req.currentUser,
    req.params.id
  );
  return success(res, { data: { reservation } });
};

exports.listReviews = async (req, res) => {
  const result = await sellerReviewService.listSellerReviews(req.currentUser, {
    page: req.query.page,
    limit: req.query.limit,
  });
  return success(res, { data: result });
};

exports.getReviewDetail = async (req, res) => {
  const result = await sellerReviewService.getSellerReviewDetail(req.currentUser, req.params.id);
  return success(res, { data: result });
};

exports.confirmReservation = async (req, res) => {
  const reservation = await reservationService.confirmReservation(req.currentUser, req.params.id);
  return success(res, {
    message: "Đã xác nhận đơn giữ hàng.",
    data: { reservation },
  });
};

exports.rejectReservation = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "note"]);
  const reservation = await reservationService.rejectReservation(req.currentUser, req.params.id, {
    reason,
  });
  return success(res, {
    message: "Đã từ chối đơn giữ hàng.",
    data: { reservation },
  });
};

exports.cancelReservation = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "note"]);
  const images = Array.isArray(req.body?.images) ? req.body.images : [];
  const reservation = await reservationService.cancelReservationBySeller(
    req.currentUser,
    req.params.id,
    { reason, images }
  );
  const afterAccept = Boolean(reservation?.cancelledBySellerAfterAccept);
  return success(res, {
    message: afterAccept
      ? "Đã hủy đơn sau xác nhận. Tiền cọc đã hoàn cho người mua."
      : "Đã hủy đơn giữ hàng.",
    data: { reservation },
  });
};

exports.refundDisputeDeposit = async (req, res) => {
  const reservation = await reservationService.refundDisputeDepositBySeller(
    req.currentUser,
    req.params.id
  );
  return success(res, {
    message: "Đã hoàn cọc cho người mua. Đơn đã kết thúc tranh chấp.",
    data: { reservation },
  });
};

exports.validatePickupQr = async (req, res) => {
  const qrPayload =
    pickBodyValue(req.body, ["qrPayload", "qr_payload", "payload", "data"]) ||
    pickBodyValue(req.body, ["rawPayload", "raw_payload"]);
  if (!qrPayload) {
    return fail(res, { status: 400, message: "Thiếu mã QR (qrPayload)." });
  }
  const data = await reservationService.validateSellerPickupQr(req.currentUser, qrPayload);
  return success(res, {
    message: "Mã QR hợp lệ.",
    data,
  });
};

exports.confirmDelivered = async (req, res) => {
  const reservation = await reservationService.confirmDeliveredBySeller(
    req.currentUser,
    req.params.id
  );
  return success(res, {
    message: "Đã xác nhận giao hàng. Tiền cọc đang được giữ trong thời gian khiếu nại.",
    data: { reservation },
  });
};

exports.adjustReservationAtPickup = async (req, res) => {
  const reservationAdjustmentService = require("../services/reservationAdjustmentService");
  const reservation = await reservationAdjustmentService.adjustReservationAtPickup(
    req.currentUser,
    req.params.id,
    req.body
  );
  return success(res, {
    message: "Đã cập nhật đơn giữ hàng.",
    data: { reservation },
  });
};

exports.respondToPostDeliveryComplaint = async (req, res) => {
  const reservationDisputeService = require("../services/reservationDisputeService");
  const reservationId = req.params.id;
  const description = pickBodyValue(req.body, ["description", "content", "note"]);
  const images = req.body.images || req.body.imageUrls || [];
  const data = await reservationDisputeService.sellerRespondToPostDeliveryComplaint(
    req.currentUser,
    { reservationId, description, images }
  );
  return success(res, {
    message: "Đã gửi phản hồi khiếu nại. Admin sẽ xử lý tranh chấp.",
    data,
  });
};

exports.getStats = async (req, res) => {
  const stats = await sellerStatsService.getSellerStats(req.currentUser, req.query);
  return success(res, { data: { stats } });
};

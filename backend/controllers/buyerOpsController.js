const buyerOpsService = require("../services/buyerOpsService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

exports.listOrders = async (req, res) => {
  const tab = req.query.tab || "pending";
  const search = pickBodyValue(req.query, ["search", "q"]);
  const data = await buyerOpsService.listBuyerOrders(req.currentUser, {
    tab,
    search,
    page: req.query.page,
    limit: req.query.limit,
  });
  return success(res, { data });
};

exports.createReservation = async (req, res) => {
  const productId = pickBodyValue(req.body, ["productId", "product_id"]);
  const variantId = pickBodyValue(req.body, ["variantId", "variant_id"]);
  const pickupTime = req.body.pickupTime ?? req.body.pickup_time;

  if (!productId || !variantId || !pickupTime) {
    return fail(res, {
      status: 400,
      message: "Thiếu sản phẩm, biến thể hoặc thời gian nhận hàng.",
    });
  }

  const reservation = await buyerOpsService.createReservation(req.currentUser, req.body);
  return success(res, {
    message: "Đã gửi yêu cầu giữ hàng.",
    data: { reservation },
  });
};

exports.getReservation = async (req, res) => {
  const reservation = await buyerOpsService.getBuyerReservation(req.currentUser, req.params.id);
  return success(res, { data: { reservation } });
};

exports.cancelReservation = async (req, res) => {
  const reservation = await buyerOpsService.cancelReservationByBuyer(
    req.currentUser,
    req.params.id
  );
  return success(res, {
    message: "Đã hủy yêu cầu giữ hàng.",
    data: { reservation },
  });
};

exports.confirmReceived = async (req, res) => {
  const reservationId =
    pickBodyValue(req.body, ["reservationId", "reservation_id", "id"]) || req.params.id;
  const scannedShopId = pickBodyValue(req.body, [
    "scannedShopId",
    "scanned_shop_id",
    "shopId",
    "shop_id",
  ]);

  if (!reservationId) {
    return fail(res, { status: 400, message: "Thiếu reservationId." });
  }

  const reservation = await buyerOpsService.confirmReceivedByBuyer(
    req.currentUser,
    reservationId,
    { scannedShopId }
  );
  return success(res, {
    message: "Đã xác nhận nhận hàng. Cọc đã chuyển cho người bán.",
    data: { reservation },
  });
};

exports.validateShopQrScan = async (req, res) => {
  const reservationId =
    pickBodyValue(req.body, ["reservationId", "reservation_id", "id"]) || req.params.id;
  const scannedShopId = pickBodyValue(req.body, [
    "scannedShopId",
    "scanned_shop_id",
    "shopId",
    "shop_id",
  ]);

  if (!reservationId) {
    return fail(res, { status: 400, message: "Thiếu reservationId." });
  }

  const data = await buyerOpsService.validateShopQrScan(
    req.currentUser,
    reservationId,
    scannedShopId
  );
  return success(res, {
    message: data.message,
    data,
  });
};

exports.reportReservation = async (req, res) => {
  const reservationId =
    pickBodyValue(req.body, ["reservationId", "reservation_id", "id"]) || req.params.id;
  const reason = pickBodyValue(req.body, ["reason"]);
  const description = pickBodyValue(req.body, ["description", "note"]);
  const images = req.body.images || req.body.imageUrls || [];

  if (!reservationId) {
    return fail(res, { status: 400, message: "Thiếu reservationId." });
  }

  if (!reason) {
    return fail(res, { status: 400, message: "Thiếu lý do báo cáo." });
  }

  const result = await buyerOpsService.reportReservationByBuyer(
    req.currentUser,
    reservationId,
    { reason, description, images }
  );

  // buyerReportSeller trả { report, reservation }; legacy trả reservation thuần.
  const reservation = result?.reservation || result;
  const report = result?.report || null;

  return success(res, {
    message: "Đã gửi báo cáo. Admin sẽ xử lý tranh chấp.",
    data: { reservation, report },
  });
};

/** Buyer đồng ý mất cọc sau quá giờ nhận → giải ngân seller. */
exports.forfeitDeposit = async (req, res) => {
  const reservationId =
    pickBodyValue(req.body, ["reservationId", "reservation_id", "id"]) || req.params.id;
  if (!reservationId) {
    return fail(res, { status: 400, message: "Thiếu reservationId." });
  }

  const reservation = await buyerOpsService.forfeitDepositByBuyer(
    req.currentUser,
    reservationId
  );
  return success(res, {
    message: "Bạn đã đồng ý mất cọc. Tiền cọc đã chuyển cho người bán.",
    data: { reservation },
  });
};

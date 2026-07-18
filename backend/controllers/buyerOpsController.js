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
  const tab = req.query.tab || "holding";
  const search = pickBodyValue(req.query, ["search", "q"]);
  const data = await buyerOpsService.listBuyerOrders(req.currentUser, { tab, search });
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

exports.completeReservation = async (req, res) => {
  const reservation = await buyerOpsService.completeReservationByBuyer(
    req.currentUser,
    req.params.id
  );
  return success(res, {
    message: "Đã xác nhận lấy hàng thành công.",
    data: { reservation },
  });
};

const reservationDisputeService = require("../services/reservationDisputeService");
const buyerOpsService = require("../services/buyerOpsService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return body[key];
    }
  }
  return "";
}

/** POST /reports/buyer-report-seller */
exports.buyerReportSeller = async (req, res) => {
  const reservationId = pickBodyValue(req.body, ["reservationId", "reservation_id", "id"]);
  if (!reservationId) {
    return fail(res, { status: 400, message: "Thiếu reservationId." });
  }

  const reason = pickBodyValue(req.body, ["reason"]);
  const result = await buyerOpsService.reportReservationByBuyer(
    req.currentUser,
    String(reservationId).trim(),
    {
      description: pickBodyValue(req.body, ["description", "content", "note"]),
      reason,
      images: req.body.images || req.body.imageUrls || [],
    }
  );

  const reservation = result?.reservation || result;
  const report = result?.report || result?.dispute || null;
  const isPostDelivery = Boolean(result?.dispute && !result?.report);

  return success(res, {
    message: isPostDelivery
      ? "Đã gửi khiếu nại. Shop có thời gian phản hồi, sau đó admin sẽ xử lý."
      : "Đã gửi báo cáo. Đơn chuyển sang tranh chấp, cọc giữ ở ví hệ thống chờ admin.",
    data: { reservation, report, ...(result?.dispute ? { dispute: result.dispute } : {}) },
  });
};

/** POST /reports/seller-report-buyer */
exports.sellerReportBuyer = async (req, res) => {
  const reservationId = pickBodyValue(req.body, ["reservationId", "reservation_id", "id"]);
  if (!reservationId) {
    return fail(res, { status: 400, message: "Thiếu reservationId." });
  }

  const data = await reservationDisputeService.sellerReportBuyer(req.currentUser, {
    reservationId: String(reservationId).trim(),
    reason: pickBodyValue(req.body, ["reason"]),
    description: pickBodyValue(req.body, ["description", "content", "note", "sellerContent"]),
    images: req.body.images || req.body.imageUrls || [],
  });

  return success(res, {
    message: "Đã gửi báo cáo buyer không đến nhận. Đơn chuyển sang tranh chấp.",
    data,
  });
};

/** GET /reports/reservation/:reservationId */
exports.listReservationReports = async (req, res) => {
  const reservationId = String(req.params.reservationId || "").trim();
  if (!reservationId) {
    return fail(res, { status: 400, message: "Thiếu reservationId." });
  }

  const data = await reservationDisputeService.listReservationDisputeReports(
    req.currentUser,
    reservationId,
    { isAdmin: Number(req.currentUser?.Role) === 3 }
  );

  return success(res, { data });
};

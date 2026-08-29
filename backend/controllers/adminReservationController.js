const adminReservationService = require("../services/adminReservationService");
const { success } = require("../utils/apiResponse");

function pickQueryValue(query, keys) {
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body?.[key] !== undefined && body?.[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

function buildListQuery(req) {
  return {
    search: pickQueryValue(req.query, ["search", "q"]),
    status: pickQueryValue(req.query, ["status"]),
    tab: pickQueryValue(req.query, ["tab"]),
    buyerId: pickQueryValue(req.query, ["buyerId", "userId"]),
    productId: pickQueryValue(req.query, ["productId"]),
    sellerId: pickQueryValue(req.query, ["sellerId", "shopId"]),
    dateFrom: pickQueryValue(req.query, ["dateFrom", "from"]),
    dateTo: pickQueryValue(req.query, ["dateTo", "to"]),
    page: req.query.page,
    limit: req.query.limit,
  };
}

exports.getReservationStats = async (req, res) => {
  const stats = await adminReservationService.getReservationStats();
  return success(res, { data: { stats } });
};

exports.listReservations = async (req, res) => {
  const data = await adminReservationService.listReservations(buildListQuery(req));
  return success(res, { data });
};

exports.listDisputes = async (req, res) => {
  const data = await adminReservationService.listDisputes(buildListQuery(req));
  return success(res, { data });
};

exports.getReservationDetail = async (req, res) => {
  const reservation = await adminReservationService.getReservationDetail(req.params.id);
  return success(res, { data: { reservation } });
};

exports.refundToBuyer = async (req, res) => {
  const note = pickBodyValue(req.body, ["note", "reason"]);
  const reservation = await adminReservationService.refundToBuyer(
    req.currentUser,
    req.params.id,
    { note }
  );
  return success(res, {
    message: "Đã hoàn cọc cho người mua.",
    data: { reservation },
  });
};

exports.releaseToSeller = async (req, res) => {
  const note = pickBodyValue(req.body, ["note", "reason"]);
  const reservation = await adminReservationService.releaseToSeller(
    req.currentUser,
    req.params.id,
    { note }
  );
  return success(res, {
    message: "Đã giải phóng cọc cho người bán.",
    data: { reservation },
  });
};

exports.rejectDispute = async (req, res) => {
  const note = pickBodyValue(req.body, ["note", "reason"]);
  const reservation = await adminReservationService.rejectDispute(
    req.currentUser,
    req.params.id,
    { note }
  );
  return success(res, {
    message: "Đã bác bỏ tranh chấp. Cọc vẫn giữ ở ví hệ thống cho đến khi admin quyết định.",
    data: { reservation },
  });
};

exports.cancelReservation = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "cancelNote", "cancelReason", "note"]);
  const reservation = await adminReservationService.cancelReservation(
    req.currentUser,
    req.params.id,
    reason
  );
  return success(res, {
    message: "Đã hủy đơn giữ hàng.",
    data: { reservation },
  });
};

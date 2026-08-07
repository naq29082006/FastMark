const crypto = require("crypto");
const Report = require("../models/Report");
const {
  normalizeEmbeddedImages,
  toPublicImageList,
} = require("../utils/embeddedImages");
const Reservation = require("../models/Reservation");
const ReservationDispute = require("../models/ReservationDispute");
const ShopProfile = require("../models/ShopProfile");
const {
  RESERVATION_STATUS,
  DISPUTE_VIRTUAL_REPORT_TYPE,
  REPORT_TYPE_LABELS,
  MAX_RESERVATION_REPORT_IMAGES,
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABEL,
  normalizeBuyerDisputeReason,
  RESERVATION_AUDIT_ACTION,
  NOTIFICATION_AUDIENCE,
  REPORT_REPORTER_ROLE,
  REPORT_REPORTER_ROLE_LABELS,
  RESERVATION_CANCEL_REASON,
  BUYER_COMPLAINT_REASON_OPTIONS,
  MAX_RESERVATION_DISPUTE_VIDEOS,
  RESERVATION_DISPUTE_STATUS,
  DISPUTE_CREATED_BY,
  DISPUTE_STATUS,
  DISPUTE_STATUS_LABEL,
} = require("../constants");
const {
  upsertPartyComplaint,
  getPartyComplaint,
  partyHasComplaint,
  markReservationDisputed,
  appendDisputeAuditLog,
  disputeViewFromRecord,
} = require("../utils/reservationDisputeView");
const {
  normalizeDisputeReasonType,
  disputeReasonTypeLabel,
  disputeReasonLegacyString,
} = require("../utils/disputeReasonType");
const { toPublicReservationDispute } = require("./reservationEscrowService");
const {
  DISPUTE_KIND,
  computeSellerResponseDeadline,
  DEFAULT_SELLER_RESPONSE_DAYS,
  isPostDeliveryDispute,
  hasSellerResponse,
  isSellerResponseWindowOpen,
  canAdminResolvePostDeliveryDispute,
  sellerResponsePublicView,
} = require("../utils/postDeliveryDispute");
const { createNotification, NOTIFICATION_INDEX } = require("./notificationService");
const { emitOrderUpdated } = require("./orderRealtimeService");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const {
  toPublicReservation,
  isPastPickupTime,
  isWithinDepositDecisionWindow,
  processReservationLifecycle,
  refundDepositIfHeld,
  releaseDepositIfHeld,
  releaseVariantInventory,
} = require("./reservationService");
const { getShopForSeller } = require("./shopSettingsService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function parseCoordinate(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw createServiceError(`${label} không hợp lệ.`);
  }
  return num;
}

async function resolveEvidenceImageUrl(imageInput) {
  if (imageInput && typeof imageInput === "object") {
    const existing = pickString(imageInput.imageUrl || imageInput.ImageUrl || imageInput.url);
    if (existing && /^https?:\/\//i.test(existing)) {
      return existing;
    }
    const base64 = imageInput.imageBase64 || imageInput.ImageBase64 || imageInput.base64;
    if (base64) {
      return resolveEvidenceImageUrl(
        String(base64).startsWith("data:")
          ? base64
          : `data:${imageInput.mimeType || "image/jpeg"};base64,${base64}`
      );
    }
  }

  const raw = pickString(imageInput);
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const match = raw.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    throw createServiceError("Định dạng ảnh chứng cứ không hợp lệ.", 400);
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw createServiceError("Ảnh chứng cứ trống.", 400);
  }

  const uploaded = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder: "report-images",
    fileName: `report-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${resolveFileExtension(mimeType)}`,
  });
  return uploaded.publicUrl;
}

async function normalizeImageUrls(images = []) {
  const list = Array.isArray(images) ? images : [];
  if (list.length > MAX_RESERVATION_REPORT_IMAGES) {
    throw createServiceError(
      `Mỗi báo cáo tối đa ${MAX_RESERVATION_REPORT_IMAGES} ảnh chứng cứ.`,
      400
    );
  }

  const urls = [];
  for (const item of list) {
    const url = await resolveEvidenceImageUrl(item);
    if (url) {
      urls.push(url);
    }
  }
  return urls;
}

async function normalizeVideoUrls(videos = []) {
  const list = Array.isArray(videos) ? videos : [];
  if (list.length > MAX_RESERVATION_DISPUTE_VIDEOS) {
    throw createServiceError(
      `Mỗi khiếu nại tối đa ${MAX_RESERVATION_DISPUTE_VIDEOS} video.`,
      400
    );
  }
  const urls = [];
  for (const item of list) {
    const url =
      typeof item === "string"
        ? pickString(item)
        : pickString(item?.url || item?.videoUrl || item?.video);
    if (url && /^https?:\/\//i.test(url)) {
      urls.push(url);
    }
  }
  return urls;
}

function normalizeComplaintReason(reason) {
  const raw = normalizeBuyerDisputeReason(reason);
  if (!raw || !BUYER_COMPLAINT_REASON_OPTIONS.includes(raw)) {
    return "";
  }
  return raw;
}

function normalizeReportImages(imageUrls = []) {
  return toPublicImageList(normalizeEmbeddedImages(imageUrls));
}

function complaintToPublicReport(dispute, party, complaint, extras = {}) {
  if (!dispute || !complaint) {
    return null;
  }
  const isSeller = party === "seller";
  const reporterRole = isSeller ? REPORT_REPORTER_ROLE.SELLER : REPORT_REPORTER_ROLE.BUYER;
  const reasonType = normalizeDisputeReasonType(complaint.reasonType);
  const reason = extras.reason || disputeReasonLegacyString(reasonType);
  const reasonLabel =
    extras.reasonLabel || disputeReasonTypeLabel(reasonType);
  const content = complaint.content || "";
  const status = Number(dispute.status);

  return {
    id: `${String(dispute._id)}-${party}`,
    disputeId: String(dispute._id),
    reservationId: dispute.reservationId ? String(dispute.reservationId) : "",
    userId: complaint.userId ? String(complaint.userId) : "",
    shopId: complaint.shopId ? String(complaint.shopId) : "",
    reporterRole,
    reporterRoleLabel: REPORT_REPORTER_ROLE_LABELS[reporterRole] || "Không rõ",
    reporterSide: party,
    title: reasonLabel,
    content,
    description: content,
    reason,
    reasonLabel,
    status,
    statusLabel: DISPUTE_STATUS_LABEL[status] || "Không rõ",
    adminNote: dispute.adminNote || "",
    resolvedAt: dispute.resolvedAt || null,
    createdAt: complaint.createdAt || dispute.createdAt || null,
    updatedAt: dispute.updatedAt || null,
    images: normalizeReportImages(complaint.images),
    reportType: isSeller
      ? DISPUTE_VIRTUAL_REPORT_TYPE.BUYER_NO_SHOW
      : DISPUTE_VIRTUAL_REPORT_TYPE.SELLER_NO_SHOW,
    reportTypeLabel: reasonLabel,
  };
}

function disputeToPublicReports(dispute) {
  if (!dispute) {
    return [];
  }
  const reports = [];
  const buyer = getPartyComplaint(dispute, "buyer");
  const seller = getPartyComplaint(dispute, "seller");
  if (buyer) {
    reports.push(complaintToPublicReport(dispute, "buyer", buyer));
  }
  if (seller) {
    reports.push(complaintToPublicReport(dispute, "seller", seller));
  }
  return reports;
}

function toPublicDispute(dispute) {
  if (!dispute) {
    return null;
  }
  const status = Number(dispute.status);
  return {
    id: String(dispute._id),
    reservationId: dispute.reservationId ? String(dispute.reservationId) : "",
    status,
    statusLabel: DISPUTE_STATUS_LABEL[status] || "Không rõ",
    adminNote: dispute.adminNote || "",
    resolvedAt: dispute.resolvedAt || null,
    createdAt: dispute.createdAt || dispute.CreatedAt || null,
    updatedAt: dispute.updatedAt || dispute.UpdatedAt || null,
    buyerComplaint: getPartyComplaint(dispute, "buyer"),
    sellerComplaint: getPartyComplaint(dispute, "seller"),
    sellerResponse: sellerResponsePublicView(dispute),
    disputeKind: dispute.disputeKind || DISPUTE_KIND.PICKUP,
    sellerRespondedAt: dispute.sellerRespondedAt || null,
    sellerResponseDeadlineAt: dispute.sellerResponseDeadlineAt || null,
    reports: disputeToPublicReports(dispute),
    auditLogs: (dispute.auditLogs || []).map((log, index) => ({
      id: String(log._id || index),
      adminId: log.adminId ? String(log.adminId) : "",
      action: log.action || "",
      decision: log.decision || "",
      note: log.note || "",
      createdAt: log.createdAt || log.CreatedAt || null,
    })),
  };
}

const toPublicDisputeReport = (dispute, extras = {}) => {
  const reports = disputeToPublicReports(dispute);
  if (extras.party) {
    return reports.find((row) => row.reporterSide === extras.party) || reports[0] || null;
  }
  return reports[0] || toPublicDispute(dispute);
};

async function hasReservationDisputeReport(reservationId) {
  if (!reservationId) {
    return false;
  }
  const dispute = await ReservationDispute.findOne({ reservationId }).lean();
  return Boolean(dispute && (partyHasComplaint(dispute, "buyer") || partyHasComplaint(dispute, "seller")));
}

async function loadReservationDisputeOrThrow(disputeId) {
  let dispute = await ReservationDispute.findById(disputeId);
  if (dispute) {
    return dispute;
  }
  const legacyReport = await Report.findById(disputeId).select("reservationId").lean();
  if (legacyReport?.reservationId) {
    dispute = await ReservationDispute.findOne({ reservationId: legacyReport.reservationId });
    if (dispute) {
      return dispute;
    }
  }
  throw createServiceError("Không tìm thấy khiếu nại.", 404);
}

function assertDisputePending(dispute) {
  if (Number(dispute.status) !== DISPUTE_STATUS.PENDING) {
    throw createServiceError("Khiếu nại đã được xử lý trước đó.", 400);
  }
}

/** Admin: pickup = cả hai báo cáo; post-delivery = buyer khiếu nại + seller đã phản hồi hoặc hết 2 ngày. */
function assertAdminCanResolveDispute(dispute, reservation) {
  const view = disputeViewFromRecord(dispute);
  if (isPostDeliveryDispute(dispute, reservation)) {
    if (!view.disputeByBuyer) {
      throw createServiceError("Chưa có khiếu nại từ người mua.", 400);
    }
    if (!canAdminResolvePostDeliveryDispute(dispute)) {
      throw createServiceError(
        `Shop có ${DEFAULT_SELLER_RESPONSE_DAYS} ngày để phản hồi khiếu nại trước khi admin xử lý.`,
        403
      );
    }
    return;
  }
  if (!view.disputeByBuyer || !view.disputeBySeller) {
    throw createServiceError(
      "Admin chỉ xử lý khi cả người mua và người bán đều đã báo cáo.",
      403
    );
  }
}

function assertReservationNotCompleted(reservation) {
  const status = Number(reservation.status);
  if (
    status === RESERVATION_STATUS.COMPLETED ||
    status === RESERVATION_STATUS.AUTO_COMPLETED
  ) {
    throw createServiceError("Không thể báo cáo đơn đã hoàn thành.", 400);
  }
  if (status === RESERVATION_STATUS.REJECTED || status === RESERVATION_STATUS.CANCELLED) {
    throw createServiceError("Không thể báo cáo đơn đã hủy / hoàn cọc.", 400);
  }
}

/**
 * Buyer báo seller không bán / không mở cửa sau PickupTime.
 * POST /reports/buyer-report-seller
 */
async function buyerReportSeller(user, payload = {}) {
  await processReservationLifecycle();

  const reservationId = pickString(payload.reservationId || payload.id);
  if (!reservationId) {
    throw createServiceError("Thiếu reservationId.");
  }

  const reason = normalizeBuyerDisputeReason(payload.reason);
  if (!reason) {
    throw createServiceError(
      "Vui lòng chọn lý do báo cáo (người bán không có mặt / shop đóng cửa / không giao hàng / khác)."
    );
  }

  const content = pickString(payload.description || payload.content || payload.note);
  if (reason === RESERVATION_DISPUTE_REASON.OTHER && !content) {
    throw createServiceError("Vui lòng nhập giải thích khi chọn lý do Khác.");
  }
  const reasonLabel = RESERVATION_DISPUTE_REASON_LABEL[reason] || reason;
  const resolvedContent = content || reasonLabel;

  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);

  const reservation = await Reservation.findOne({
    _id: reservationId,
    userId: user._id,
  });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  assertReservationNotCompleted(reservation);

  const status = Number(reservation.status);
  if (
    status !== RESERVATION_STATUS.WAITING_PICKUP &&
    status !== RESERVATION_STATUS.DISPUTED
  ) {
    throw createServiceError("Chỉ báo cáo được khi đơn đang chờ nhận hàng hoặc tranh chấp.");
  }
  if (!isPastPickupTime(reservation)) {
    throw createServiceError("Chỉ báo cáo sau giờ nhận hàng đã chọn.", 403);
  }
  if (!isWithinDepositDecisionWindow(reservation) && status !== RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Đã hết thời gian báo cáo tranh chấp (24 giờ sau giờ nhận).", 403);
  }

  const existingDispute = await ReservationDispute.findOne({
    reservationId: reservation._id,
  }).lean();
  if (existingDispute && partyHasComplaint(existingDispute, "buyer")) {
    throw createServiceError("Bạn đã gửi khiếu nại cho đơn này.", 409);
  }

  const now = new Date();
  const isFirstComplaint = !existingDispute;

  const dispute = await upsertPartyComplaint({
    reservation,
    party: "buyer",
    userId: user._id,
    reason,
    content: resolvedContent,
    images: imageUrls,
  });

  if (dispute.disputeKind !== DISPUTE_KIND.POST_DELIVERY) {
    dispute.disputeKind = DISPUTE_KIND.PICKUP;
    dispute.updatedAt = now;
    await dispute.save();
  }

  if (isFirstComplaint) {
    await markReservationDisputed(reservation, { now });
  }
  if (existingDispute && partyHasComplaint(existingDispute, "seller")) {
    reservation.cancelReason = RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED;
  } else {
    reservation.cancelReason = RESERVATION_CANCEL_REASON.BUYER_REPORT_SELLER_ABSENT;
  }
  reservation.UpdatedAt = now;
  await reservation.save();

  const shop = await ShopProfile.findById(reservation.shopId);
  if (shop?.userId) {
    await createNotification(shop.userId, {
      title: "Khách đã tố cáo bạn không có mặt",
      content: `${user.FullName || user.UserName || "Người mua"} báo cáo: ${reasonLabel}. Cọc đang giữ chờ admin xử lý.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await createNotification(user._id, {
    title: "Đã gửi báo cáo tranh chấp",
    content: `Báo cáo về shop đã được ghi nhận (${reasonLabel}). Cọc đang giữ chờ admin xử lý.`,
    audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
  });

  await emitOrderUpdated(reservation, { action: "buyer_dispute" });
  const report = complaintToPublicReport(dispute, "buyer", getPartyComplaint(dispute, "buyer"), {
    reason,
    reasonLabel,
  });
  return {
    dispute: toPublicDispute(dispute),
    report,
    reservation: await toPublicReservation(reservation),
  };
}

/**
 * Seller báo buyer không đến nhận hàng sau PickupTime.
 * POST /reports/seller-report-buyer
 */
async function sellerReportBuyer(user, payload = {}) {
  await processReservationLifecycle();

  const reservationId = pickString(payload.reservationId || payload.id);
  if (!reservationId) {
    throw createServiceError("Thiếu reservationId.");
  }

  const content = pickString(payload.description || payload.content || payload.note);
  if (!content) {
    throw createServiceError("Vui lòng nhập nội dung mô tả.");
  }

  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);

  const shop = await getShopForSeller(user);
  const reservation = await Reservation.findOne({
    _id: reservationId,
    shopId: shop._id,
  });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng của gian hàng.", 404);
  }

  assertReservationNotCompleted(reservation);

  const status = Number(reservation.status);
  if (
    status !== RESERVATION_STATUS.WAITING_PICKUP &&
    status !== RESERVATION_STATUS.DISPUTED
  ) {
    throw createServiceError("Chỉ báo cáo được khi đơn đang chờ nhận hàng hoặc tranh chấp.");
  }
  if (!isPastPickupTime(reservation)) {
    throw createServiceError("Chỉ báo cáo sau giờ nhận hàng đã chọn.", 403);
  }
  if (!isWithinDepositDecisionWindow(reservation) && status !== RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Đã hết thời gian báo cáo tranh chấp (24 giờ sau giờ nhận).", 403);
  }

  const existingDispute = await ReservationDispute.findOne({
    reservationId: reservation._id,
  }).lean();
  if (existingDispute && partyHasComplaint(existingDispute, "seller")) {
    throw createServiceError("Shop đã gửi khiếu nại cho đơn này.", 409);
  }

  const now = new Date();
  const isFirstComplaint = !existingDispute;

  const dispute = await upsertPartyComplaint({
    reservation,
    party: "seller",
    shopId: shop._id,
    reason: RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW,
    content,
    images: imageUrls,
  });

  if (dispute.disputeKind !== DISPUTE_KIND.POST_DELIVERY) {
    dispute.disputeKind = DISPUTE_KIND.PICKUP;
    dispute.updatedAt = now;
    await dispute.save();
  }

  if (isFirstComplaint) {
    await markReservationDisputed(reservation, { now });
  }
  if (existingDispute && partyHasComplaint(existingDispute, "buyer")) {
    reservation.cancelReason = RESERVATION_CANCEL_REASON.DISPUTE_BOTH_REPORTED;
  } else {
    reservation.cancelReason = RESERVATION_CANCEL_REASON.SELLER_REPORT_BUYER_NO_SHOW;
  }
  reservation.UpdatedAt = now;
  await reservation.save();

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Shop báo cáo bạn không đến nhận hàng",
      content: "Người bán đã tố cáo bạn không đến lấy hàng. Cọc đang giữ chờ admin xử lý.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await createNotification(user._id, {
    title: "Đã gửi báo cáo tranh chấp",
    content: "Báo cáo về người mua đã được ghi nhận. Cọc đang giữ chờ admin xử lý.",
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
  });

  await emitOrderUpdated(reservation, { action: "seller_dispute" });
  const reason = RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW;
  const reasonLabel = RESERVATION_DISPUTE_REASON_LABEL[reason];
  const report = complaintToPublicReport(dispute, "seller", getPartyComplaint(dispute, "seller"), {
    reason,
    reasonLabel,
  });
  return {
    dispute: toPublicDispute(dispute),
    report,
    reservation: await toPublicReservation(reservation),
  };
}

/**
 * Danh sách khiếu nại tranh chấp của 1 đơn — buyer/seller participant hoặc admin.
 */
async function listReservationDisputeReports(user, reservationId, { isAdmin = false } = {}) {
  const id = pickString(reservationId);
  if (!id) {
    throw createServiceError("Thiếu reservationId.");
  }

  const reservation = await Reservation.findById(id);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (!isAdmin) {
    const isBuyer = String(reservation.userId) === String(user._id);
    let isSeller = false;
    if (!isBuyer && reservation.shopId) {
      const shop = await ShopProfile.findById(reservation.shopId).select("userId").lean();
      isSeller = shop && String(shop.userId) === String(user._id);
    }
    if (!isBuyer && !isSeller) {
      throw createServiceError("Bạn không có quyền xem báo cáo của đơn này.", 403);
    }
  }

  const dispute = await ReservationDispute.findOne({ reservationId: reservation._id }).lean();
  const reports = disputeToPublicReports(dispute);

  return {
    reservationId: String(reservation._id),
    dispute: dispute ? toPublicDispute(dispute) : null,
    reports,
  };
}

async function loadReservationReportOrThrow(disputeId) {
  return loadReservationDisputeOrThrow(disputeId);
}

/**
 * Admin duyệt về phía buyer → hoàn cọc + đóng dispute.
 * POST /admin/reports/:id/approve-buyer  (:id = disputeId)
 */
async function adminApproveBuyer(adminUser, disputeId, { note } = {}) {
  const dispute = await loadReservationDisputeOrThrow(disputeId);
  assertDisputePending(dispute);

  const reservation = await Reservation.findById(dispute.reservationId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng liên quan.", 404);
  }
  assertAdminCanResolveDispute(dispute, reservation);

  const status = Number(reservation.status);
  if (
    status === RESERVATION_STATUS.COMPLETED ||
    status === RESERVATION_STATUS.AUTO_COMPLETED ||
    status === RESERVATION_STATUS.CANCELLED ||
    status === RESERVATION_STATUS.REJECTED
  ) {
    throw createServiceError("Đơn giữ hàng đã kết thúc, không thể hoàn cọc lại.", 400);
  }

  await refundDepositIfHeld(reservation);
  await releaseVariantInventory(reservation);

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = reservation.cancelledAt || now;
  reservation.cancelledBy = "admin";
  reservation.cancelReason = RESERVATION_CANCEL_REASON.ADMIN_BUYER_WIN;
  reservation.cancelNote = pickString(note);
  reservation.UpdatedAt = now;
  await reservation.save();

  dispute.status = RESERVATION_DISPUTE_STATUS.BUYER_WIN;
  dispute.resolvedBy = adminUser._id;
  dispute.resolvedAt = now;
  dispute.adminNote = pickString(note) || dispute.adminNote;
  await appendDisputeAuditLog(dispute, {
    adminId: adminUser._id,
    action: RESERVATION_AUDIT_ACTION.ADMIN_REFUND_BUYER,
    decision: "buyer_win",
    note,
  });

  if (reservation.userId) {
    await createNotification(reservation.userId, {
      title: "Admin đã xử lý tranh chấp",
      content: "Bạn thắng tranh chấp. Tiền cọc đã được hoàn về ví.",
      audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await emitOrderUpdated(reservation, { action: "admin_approve_buyer" });
  return {
    dispute: toPublicDispute(dispute),
    report: toPublicDispute(dispute),
    reservation: await toPublicReservation(reservation),
  };
}

/**
 * Admin duyệt về phía seller → giải ngân cọc + đóng dispute.
 * POST /admin/reports/:id/approve-seller  (:id = disputeId)
 */
async function adminApproveSeller(adminUser, disputeId, { note } = {}) {
  const dispute = await loadReservationDisputeOrThrow(disputeId);
  assertDisputePending(dispute);

  const reservation = await Reservation.findById(dispute.reservationId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng liên quan.", 404);
  }
  assertAdminCanResolveDispute(dispute, reservation);

  if (Number(reservation.status) !== RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Chỉ giải phóng cọc cho đơn đang tranh chấp.", 400);
  }

  const shop = reservation.shopId ? await ShopProfile.findById(reservation.shopId) : null;
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng của đơn giữ hàng.", 404);
  }

  const now = new Date();
  await releaseDepositIfHeld(reservation, shop);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelledBy = "admin";
  reservation.cancelReason = RESERVATION_CANCEL_REASON.ADMIN_SELLER_WIN;
  reservation.cancelNote = pickString(note);
  reservation.UpdatedAt = now;
  await reservation.save();

  dispute.status = RESERVATION_DISPUTE_STATUS.SELLER_WIN;
  dispute.resolvedBy = adminUser._id;
  dispute.resolvedAt = now;
  dispute.adminNote = pickString(note) || dispute.adminNote;
  await appendDisputeAuditLog(dispute, {
    adminId: adminUser._id,
    action: RESERVATION_AUDIT_ACTION.ADMIN_RELEASE_SELLER,
    decision: "seller_win",
    note,
  });

  if (shop.userId) {
    await createNotification(shop.userId, {
      title: "Admin đã xử lý tranh chấp",
      content:
        "Bạn thắng tranh chấp. Tiền cọc đã vào ví. Đơn được ghi nhận là đã hủy (không tính bán thành công).",
      audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await emitOrderUpdated(reservation, { action: "admin_approve_seller" });
  return {
    dispute: toPublicDispute(dispute),
    report: toPublicDispute(dispute),
    reservation: await toPublicReservation(reservation),
  };
}

/**
 * Admin bác bỏ khiếu nại — ghi audit log, không tự động giải ngân.
 * POST /admin/reports/:id/reject  (:id = disputeId)
 */
async function adminRejectReport(adminUser, disputeId, { note } = {}) {
  const dispute = await loadReservationDisputeOrThrow(disputeId);
  assertDisputePending(dispute);

  const now = new Date();
  dispute.status = DISPUTE_STATUS.REJECTED;
  dispute.resolvedBy = adminUser._id;
  dispute.resolvedAt = now;
  dispute.adminNote = pickString(note) || dispute.adminNote;
  await appendDisputeAuditLog(dispute, {
    adminId: adminUser._id,
    action: "ADMIN_REJECT_REPORT",
    decision: "reject",
    note: pickString(note) || `Reject dispute ${dispute._id}`,
  });

  let reservation = null;
  if (dispute.reservationId) {
    const doc = await Reservation.findById(dispute.reservationId);
    if (doc) {
      reservation = await toPublicReservation(doc);
    }
  }

  return {
    dispute: toPublicDispute(dispute),
    report: toPublicDispute(dispute),
    reservation,
  };
}

/**
 * Buyer khiếu nại sau khi seller xác nhận giao (trong thời gian escrow).
 */
async function buyerPostDeliveryComplaint(user, payload = {}) {
  await processReservationLifecycle();

  const reservationId = pickString(payload.reservationId || payload.id);
  if (!reservationId) {
    throw createServiceError("Thiếu reservationId.");
  }

  const reason = normalizeComplaintReason(payload.reason);
  if (!reason) {
    throw createServiceError(
      "Vui lòng chọn lý do khiếu nại (hàng hỏng, thiếu hàng, sai mô tả, hết hạn, khác)."
    );
  }

  const content = pickString(payload.description || payload.content || payload.note);
  if (reason === RESERVATION_DISPUTE_REASON.OTHER && !content) {
    throw createServiceError("Vui lòng nhập mô tả khi chọn lý do Khác.");
  }
  const reasonLabel = RESERVATION_DISPUTE_REASON_LABEL[reason] || reason;
  const resolvedContent = content || reasonLabel;

  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);
  const videoUrls = await normalizeVideoUrls(payload.videos || payload.videoUrls || []);

  const reservation = await Reservation.findOne({
    _id: reservationId,
    userId: user._id,
  });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const status = Number(reservation.status);
  if (status === RESERVATION_STATUS.DISPUTED) {
    throw createServiceError("Đơn đang trong tranh chấp.", 409);
  }
  if (
    status !== RESERVATION_STATUS.RECEIVED &&
    status !== RESERVATION_STATUS.COMPLETED
  ) {
    throw createServiceError("Chỉ khiếu nại được sau khi shop đã xác nhận giao hàng.", 403);
  }
  if (!isWithinDepositDecisionWindow(reservation)) {
    throw createServiceError("Đã hết thời gian khiếu nại.", 403);
  }
  const existingDispute = await ReservationDispute.findOne({ reservationId: reservation._id }).lean();
  if (existingDispute && partyHasComplaint(existingDispute, "buyer")) {
    throw createServiceError("Bạn đã gửi khiếu nại cho đơn này.", 409);
  }

  const shop = await ShopProfile.findById(reservation.shopId);
  const now = new Date();

  const dispute = await upsertPartyComplaint({
    reservation,
    party: "buyer",
    userId: user._id,
    reason,
    content: resolvedContent,
    images: imageUrls,
  });

  const responseDeadline = computeSellerResponseDeadline(now);
  dispute.disputeKind = DISPUTE_KIND.POST_DELIVERY;
  dispute.sellerResponseDeadlineAt = responseDeadline;
  dispute.updatedAt = now;
  await dispute.save();

  await markReservationDisputed(reservation, { now });
  reservation.cancelReason = RESERVATION_CANCEL_REASON.BUYER_POST_DELIVERY_COMPLAINT;
  reservation.UpdatedAt = now;
  await reservation.save();
  await emitOrderUpdated(reservation, { action: "buyer_complaint" });

  if (shop?.userId) {
    await createNotification(shop.userId, {
      title: "Khách khiếu nại đơn đã nhận",
      content: `${user.FullName || user.UserName || "Người mua"} khiếu nại: ${reasonLabel}. Bạn có ${DEFAULT_SELLER_RESPONSE_DAYS} ngày để phản hồi trước khi admin xử lý.`,
      audience: NOTIFICATION_AUDIENCE.SELLER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await createNotification(user._id, {
    title: "Đã gửi khiếu nại",
    content: `Khiếu nại đã ghi nhận. Shop có ${DEFAULT_SELLER_RESPONSE_DAYS} ngày để phản hồi, sau đó admin sẽ xử lý.`,
    audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
  });

  return {
    dispute: toPublicReservationDispute(dispute),
    reservation: await toPublicReservation(reservation),
  };
}

/**
 * Seller phản hồi khiếu nại sau giao hàng (trong 2 ngày).
 */
async function sellerRespondToPostDeliveryComplaint(user, payload = {}) {
  await processReservationLifecycle();

  const reservationId = pickString(payload.reservationId || payload.id);
  if (!reservationId) {
    throw createServiceError("Thiếu reservationId.");
  }

  const content = pickString(payload.description || payload.content || payload.note);
  if (!content) {
    throw createServiceError("Vui lòng nhập nội dung phản hồi.");
  }

  const imageUrls = await normalizeImageUrls(payload.images || payload.imageUrls || []);
  const shop = await getShopForSeller(user);
  const reservation = await Reservation.findOne({
    _id: reservationId,
    shopId: shop._id,
  });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng của gian hàng.", 404);
  }

  const dispute = await ReservationDispute.findOne({ reservationId: reservation._id });
  if (!dispute || !isPostDeliveryDispute(dispute, reservation)) {
    throw createServiceError("Không có khiếu nại sau giao hàng để phản hồi.", 404);
  }
  if (!partyHasComplaint(dispute, "buyer")) {
    throw createServiceError("Chưa có khiếu nại từ người mua.", 400);
  }
  if (hasSellerResponse(dispute)) {
    throw createServiceError("Shop đã phản hồi khiếu nại này.", 409);
  }
  if (!isSellerResponseWindowOpen(dispute)) {
    throw createServiceError("Đã hết thời gian phản hồi khiếu nại.", 403);
  }

  const now = new Date();
  dispute.sellerResponseContent = content;
  dispute.sellerResponseImages = normalizeEmbeddedImages(imageUrls);
  dispute.sellerRespondedAt = now;
  dispute.updatedAt = now;
  await dispute.save();

  await emitOrderUpdated(reservation, { action: "seller_dispute_response" });

  const buyerId = reservation.userId;
  if (buyerId) {
    await createNotification(buyerId, {
      title: "Shop đã phản hồi khiếu nại",
      content: `${shop.shopName || "Shop"} đã phản hồi khiếu nại của bạn. Admin sẽ xử lý trong thời gian sớm nhất.`,
      audience: NOTIFICATION_AUDIENCE.BUYER,
      index: NOTIFICATION_INDEX.ORDER,
    });
  }

  await createNotification(user._id, {
    title: "Đã gửi phản hồi",
    content: "Phản hồi của shop đã được ghi nhận. Admin sẽ xử lý tranh chấp.",
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
  });

  return {
    dispute: toPublicDispute(dispute),
    reservation: await toPublicReservation(reservation),
  };
}

module.exports = {
  buyerReportSeller,
  buyerPostDeliveryComplaint,
  sellerReportBuyer,
  sellerRespondToPostDeliveryComplaint,
  listReservationDisputeReports,
  adminApproveBuyer,
  adminApproveSeller,
  adminRejectReport,
  hasReservationDisputeReport,
  toPublicDispute,
  toPublicDisputeReport,
  MAX_RESERVATION_REPORT_IMAGES,
};

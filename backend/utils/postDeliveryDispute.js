const { partyHasComplaint } = require("./disputePartyComplaint");

const DISPUTE_KIND = {
  PICKUP: "pickup",
  POST_DELIVERY: "post_delivery",
};

const DEFAULT_SELLER_RESPONSE_DAYS = 2;
const SELLER_RESPONSE_MS = DEFAULT_SELLER_RESPONSE_DAYS * 24 * 60 * 60 * 1000;

function pickString(value) {
  return String(value || "").trim();
}

function pickDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function computeSellerResponseDeadline(fromDate = new Date()) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const safe = Number.isFinite(base.getTime()) ? base : new Date();
  return new Date(safe.getTime() + SELLER_RESPONSE_MS);
}

/** Seller khiếu nại pickup — có mã lý do. Phản hồi post-delivery không dùng maLyDoShop. */
function hasSellerComplaint(dispute) {
  const reasonType = Number(dispute?.maLyDoShop);
  return Number.isFinite(reasonType) && reasonType > 0;
}

function readSellerResponseContent(dispute) {
  if (!dispute || hasSellerComplaint(dispute)) {
    return "";
  }
  return pickString(dispute.sellerContent || dispute.ndPhShop || "");
}

function readSellerResponseImages(dispute) {
  if (!dispute || hasSellerComplaint(dispute)) {
    return [];
  }
  const images = dispute.sellerImages ?? dispute.anhPhShop ?? [];
  return Array.isArray(images) ? images : [];
}

function readSellerRespondedAt(dispute) {
  if (!dispute || hasSellerComplaint(dispute)) {
    return null;
  }
  return pickDate(dispute.tgKnShop || dispute.tgPhShop);
}

function hasSellerResponse(dispute) {
  return Boolean(readSellerResponseContent(dispute) && readSellerRespondedAt(dispute));
}

function resolveSellerResponseDeadline(dispute) {
  const stored = pickDate(dispute?.hanPhShop);
  if (stored) {
    return stored;
  }
  const buyerAt = pickDate(dispute?.tgKnBuyer);
  if (!buyerAt) {
    return null;
  }
  return computeSellerResponseDeadline(buyerAt);
}

function isPostDeliveryDispute(dispute, reservation = null) {
  if (!dispute) {
    return false;
  }
  if (dispute.disputeKind === DISPUTE_KIND.POST_DELIVERY) {
    return true;
  }
  if (dispute.disputeKind === DISPUTE_KIND.PICKUP) {
    return false;
  }
  const delivered = Boolean(
    reservation?.tgNhanHang ?? reservation?.completedAt
  );
  return (
    delivered &&
    partyHasComplaint(dispute, "buyer") &&
    !hasSellerComplaint(dispute)
  );
}

function isSellerResponseWindowOpen(dispute, now = new Date()) {
  if (!isPostDeliveryDispute(dispute) || !partyHasComplaint(dispute, "buyer")) {
    return false;
  }
  if (hasSellerResponse(dispute)) {
    return false;
  }
  const deadline = resolveSellerResponseDeadline(dispute);
  return Boolean(deadline && now.getTime() < deadline.getTime());
}

/** Admin được xử lý post-delivery sau khi seller phản hồi hoặc hết hạn 2 ngày. */
function canAdminResolvePostDeliveryDispute(dispute, now = new Date()) {
  if (!dispute || !partyHasComplaint(dispute, "buyer")) {
    return false;
  }
  if (hasSellerResponse(dispute)) {
    return true;
  }
  const deadline = resolveSellerResponseDeadline(dispute);
  if (!deadline) {
    return true;
  }
  return now.getTime() >= deadline.getTime();
}

function sellerResponsePublicView(dispute) {
  if (!dispute || !hasSellerResponse(dispute)) {
    return null;
  }
  const { toPublicImageList, normalizeEmbeddedImages } = require("./embeddedImages");
  return {
    content: readSellerResponseContent(dispute),
    images: toPublicImageList(normalizeEmbeddedImages(readSellerResponseImages(dispute))),
    respondedAt: readSellerRespondedAt(dispute),
  };
}

module.exports = {
  DISPUTE_KIND,
  DEFAULT_SELLER_RESPONSE_DAYS,
  SELLER_RESPONSE_MS,
  computeSellerResponseDeadline,
  resolveSellerResponseDeadline,
  hasSellerComplaint,
  hasSellerResponse,
  isPostDeliveryDispute,
  isSellerResponseWindowOpen,
  canAdminResolvePostDeliveryDispute,
  sellerResponsePublicView,
  readSellerResponseContent,
  readSellerRespondedAt,
};

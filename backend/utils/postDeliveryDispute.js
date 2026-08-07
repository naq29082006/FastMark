const { partyHasComplaint } = require("./disputePartyComplaint");

const DISPUTE_KIND = {
  PICKUP: "pickup",
  POST_DELIVERY: "post_delivery",
};

const DEFAULT_SELLER_RESPONSE_DAYS = 2;
const SELLER_RESPONSE_MS = DEFAULT_SELLER_RESPONSE_DAYS * 24 * 60 * 60 * 1000;

function computeSellerResponseDeadline(fromDate = new Date()) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const safe = Number.isFinite(base.getTime()) ? base : new Date();
  return new Date(safe.getTime() + SELLER_RESPONSE_MS);
}

function hasSellerResponse(dispute) {
  return Boolean(
    dispute?.sellerRespondedAt ||
      String(dispute?.sellerResponseContent || "").trim()
  );
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
  const delivered = Boolean(reservation?.completedAt);
  return (
    delivered &&
    partyHasComplaint(dispute, "buyer") &&
    !partyHasComplaint(dispute, "seller")
  );
}

function isSellerResponseWindowOpen(dispute, now = new Date()) {
  if (!dispute?.sellerResponseDeadlineAt || hasSellerResponse(dispute)) {
    return false;
  }
  const deadline = new Date(dispute.sellerResponseDeadlineAt);
  return Number.isFinite(deadline.getTime()) && now.getTime() < deadline.getTime();
}

/** Admin được xử lý post-delivery sau khi seller phản hồi hoặc hết hạn 2 ngày. */
function canAdminResolvePostDeliveryDispute(dispute, now = new Date()) {
  if (!dispute || !partyHasComplaint(dispute, "buyer")) {
    return false;
  }
  if (hasSellerResponse(dispute)) {
    return true;
  }
  if (!dispute.sellerResponseDeadlineAt) {
    return true;
  }
  const deadline = new Date(dispute.sellerResponseDeadlineAt);
  return Number.isFinite(deadline.getTime()) && now.getTime() >= deadline.getTime();
}

function sellerResponsePublicView(dispute) {
  if (!dispute || !hasSellerResponse(dispute)) {
    return null;
  }
  const { toPublicImageList } = require("./embeddedImages");
  const { normalizeEmbeddedImages } = require("./embeddedImages");
  return {
    content: String(dispute.sellerResponseContent || "").trim(),
    images: toPublicImageList(normalizeEmbeddedImages(dispute.sellerResponseImages || [])),
    respondedAt: dispute.sellerRespondedAt || null,
  };
}

module.exports = {
  DISPUTE_KIND,
  DEFAULT_SELLER_RESPONSE_DAYS,
  SELLER_RESPONSE_MS,
  computeSellerResponseDeadline,
  hasSellerResponse,
  isPostDeliveryDispute,
  isSellerResponseWindowOpen,
  canAdminResolvePostDeliveryDispute,
  sellerResponsePublicView,
};

const { DISPUTE_CREATED_BY } = require("../constants");
const { normalizeDisputeCreatedBy } = require("./reservationCompat");
const {
  normalizeDisputeReasonType,
  disputeReasonTypeLabel,
} = require("./disputeReasonType");

const BUYER_FIELDS = {
  userId: "buyerUserId",
  reasonType: "buyerReasonType",
  content: "buyerContent",
  images: "buyerImages",
  createdAt: "buyerComplaintAt",
};

const SELLER_FIELDS = {
  shopId: "sellerShopId",
  reasonType: "sellerReasonType",
  content: "sellerContent",
  images: "sellerImages",
  createdAt: "sellerComplaintAt",
};

function pickString(value) {
  return String(value || "").trim();
}

function fieldMap(party) {
  return party === "seller" ? SELLER_FIELDS : BUYER_FIELDS;
}

function resolveComplaintTitle(reasonType) {
  return disputeReasonTypeLabel(normalizeDisputeReasonType(reasonType));
}

function hasComplaintPayload(complaint) {
  if (!complaint) {
    return false;
  }
  const reasonType = Number(complaint.reasonType);
  return Boolean(
    (Number.isFinite(reasonType) && reasonType > 0) ||
      pickString(complaint.content) ||
      (Array.isArray(complaint.images) && complaint.images.length)
  );
}

function readFlatComplaint(dispute, party) {
  const map = fieldMap(party);
  const reasonType = dispute[map.reasonType];
  return party === "seller"
    ? {
        shopId: dispute[map.shopId],
        reasonType,
        title: resolveComplaintTitle(reasonType),
        content: dispute[map.content],
        images: dispute[map.images] || [],
        createdAt: dispute[map.createdAt] || null,
      }
    : {
        userId: dispute[map.userId],
        reasonType,
        title: resolveComplaintTitle(reasonType),
        content: dispute[map.content],
        images: dispute[map.images] || [],
        createdAt: dispute[map.createdAt] || null,
      };
}

/** Đọc khiếu nại một bên từ field phẳng (hỗ trợ nested buyerComplaint / schema cũ). */
function getPartyComplaint(dispute, party) {
  if (!dispute) {
    return null;
  }

  const flat = readFlatComplaint(dispute, party);
  if (hasComplaintPayload(flat)) {
    return flat;
  }

  const nested = party === "seller" ? dispute.sellerComplaint : dispute.buyerComplaint;
  if (hasComplaintPayload(nested)) {
    const reasonType = nested.reasonType;
    return party === "seller"
      ? {
          shopId: nested.shopId || dispute.sellerShopId || dispute.sellerUserId || null,
          reasonType,
          title: resolveComplaintTitle(reasonType),
          content: nested.content,
          images: nested.images || [],
          createdAt: nested.createdAt || null,
        }
      : {
          userId: nested.userId,
          reasonType,
          title: resolveComplaintTitle(reasonType),
          content: nested.content,
          images: nested.images || [],
          createdAt: nested.createdAt || null,
        };
  }

  const createdByCode = normalizeDisputeCreatedBy(dispute.createdBy);
  const isSellerParty = party === "seller";
  const matchesLegacy =
    (isSellerParty && createdByCode === DISPUTE_CREATED_BY.SELLER) ||
    (!isSellerParty && createdByCode === DISPUTE_CREATED_BY.BUYER);

  if (!matchesLegacy) {
    return null;
  }

  const reasonType = dispute.reasonType;
  return {
    userId: dispute.userId,
    shopId: dispute.sellerShopId || dispute.shopId || null,
    reasonType,
    title: resolveComplaintTitle(reasonType),
    content: dispute.content || dispute.description || "",
    images: dispute.images || [],
    createdAt: dispute.createdAt || dispute.CreatedAt || null,
  };
}

function partyHasComplaint(dispute, party) {
  return hasComplaintPayload(getPartyComplaint(dispute, party));
}

module.exports = {
  getPartyComplaint,
  partyHasComplaint,
  resolveComplaintTitle,
};

const { DISPUTE_CREATED_BY, DISPUTE_STATUS } = require("../constants");
const { normalizeDisputeCreatedBy } = require("./reservationCompat");
const {
  normalizeDisputeReasonType,
  disputeReasonTypeLabel,
} = require("./disputeReasonType");

const BUYER_FIELDS = {
  userId: "buyerUserId",
  reasonType: "maLyDoBuyer",
  content: "buyerContent",
  images: "buyerImages",
  createdAt: "tgKnBuyer",
};

const SELLER_FIELDS = {
  shopId: "sellerShopId",
  reasonType: "maLyDoShop",
  content: "sellerContent",
  images: "sellerImages",
  createdAt: "tgKnShop",
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
  if (party === "seller") {
    const reasonType = Number(dispute[map.reasonType]);
    if (!Number.isFinite(reasonType) || reasonType <= 0) {
      return null;
    }
  }
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

/** Điều kiện chung: cả buyer và seller đều đã báo cáo (pickup). */
function buildBothPartiesComplaintFilter(extra = {}) {
  return {
    maLyDoShop: { $gt: 0 },
    $or: [
      { maLyDoBuyer: { $gt: 0 } },
      { buyerContent: { $nin: [null, ""] } },
      { buyerImages: { $exists: true, $not: { $size: 0 } } },
    ],
    ...extra,
  };
}

/** Khiếu nại pickup: cả buyer và seller đã báo cáo, dispute còn PENDING — chờ admin xử lý. */
function buildBothPartiesPendingDisputeFilter() {
  return buildBothPartiesComplaintFilter({ status: DISPUTE_STATUS.PENDING });
}

/** Tranh chấp pickup đã được admin xử lý (dispute không còn PENDING). */
function buildBothPartiesResolvedDisputeFilter() {
  return buildBothPartiesComplaintFilter({ status: { $ne: DISPUTE_STATUS.PENDING } });
}

module.exports = {
  getPartyComplaint,
  partyHasComplaint,
  resolveComplaintTitle,
  buildBothPartiesComplaintFilter,
  buildBothPartiesPendingDisputeFilter,
  buildBothPartiesResolvedDisputeFilter,
};

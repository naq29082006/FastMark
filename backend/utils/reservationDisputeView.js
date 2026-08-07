const ReservationDispute = require("../models/ReservationDispute");
const ShopProfile = require("../models/ShopProfile");
const {
  DISPUTE_STATUS,
  DISPUTE_CREATED_BY,
} = require("../constants");
const {
  getReservationBuyerId,
} = require("./reservationCompat");
const {
  normalizeDisputeReasonType,
  disputeReasonTypeLabel,
  disputeReasonLegacyString,
} = require("./disputeReasonType");
const { normalizeEmbeddedImages } = require("./embeddedImages");
const {
  getPartyComplaint,
  partyHasComplaint,
  resolveComplaintTitle,
} = require("./disputePartyComplaint");
const {
  DISPUTE_KIND,
  isPostDeliveryDispute,
  isSellerResponseWindowOpen,
  hasSellerResponse,
  canAdminResolvePostDeliveryDispute,
  sellerResponsePublicView,
} = require("./postDeliveryDispute");

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

/** API flags derived from ReservationDispute (tương thích client cũ). */
function disputeViewFromRecord(dispute) {
  if (!dispute) {
    return {
      hasDispute: false,
      disputeByBuyer: false,
      disputeBySeller: false,
      disputeKind: DISPUTE_KIND.PICKUP,
      isPostDeliveryDispute: false,
      sellerResponse: null,
      sellerRespondedAt: null,
      sellerResponseDeadlineAt: null,
      canSellerRespondToComplaint: false,
      awaitingAdminReview: false,
      disputeReason: "",
      disputeReasonLabel: "",
      disputeDescription: "",
      disputedAt: null,
      disputeFirstBy: "",
      buyerDisputedAt: null,
      sellerDisputedAt: null,
      disputeRecord: null,
    };
  }

  const buyerComplaint = getPartyComplaint(dispute, "buyer");
  const sellerComplaint = getPartyComplaint(dispute, "seller");
  const disputeByBuyer = partyHasComplaint(dispute, "buyer");
  const disputeBySeller = partyHasComplaint(dispute, "seller");

  const buyerAt = buyerComplaint?.createdAt || null;
  const sellerAt = sellerComplaint?.createdAt || null;
  let disputeFirstBy = "";
  let disputedAt = dispute.createdAt || dispute.CreatedAt || null;

  if (disputeByBuyer && disputeBySeller) {
    if (buyerAt && sellerAt) {
      disputeFirstBy = buyerAt <= sellerAt ? "buyer" : "seller";
      disputedAt = buyerAt <= sellerAt ? buyerAt : sellerAt;
    } else {
      disputeFirstBy = "both";
    }
  } else if (disputeByBuyer) {
    disputeFirstBy = "buyer";
    disputedAt = buyerAt || disputedAt;
  } else if (disputeBySeller) {
    disputeFirstBy = "seller";
    disputedAt = sellerAt || disputedAt;
  }

  const primaryComplaint = buyerComplaint || sellerComplaint;
  const reasonType = normalizeDisputeReasonType(primaryComplaint?.reasonType);
  const legacyReason = disputeReasonLegacyString(reasonType);
  const sellerResponse = sellerResponsePublicView(dispute);
  const postDelivery = isPostDeliveryDispute(dispute);

  return {
    hasDispute: disputeByBuyer || disputeBySeller,
    disputeByBuyer,
    disputeBySeller,
    disputeKind: dispute?.disputeKind || (postDelivery ? DISPUTE_KIND.POST_DELIVERY : DISPUTE_KIND.PICKUP),
    isPostDeliveryDispute: postDelivery,
    sellerResponse,
    sellerRespondedAt: dispute?.sellerRespondedAt || null,
    sellerResponseDeadlineAt: dispute?.sellerResponseDeadlineAt || null,
    canSellerRespondToComplaint:
      postDelivery &&
      disputeByBuyer &&
      !hasSellerResponse(dispute) &&
      isSellerResponseWindowOpen(dispute),
    awaitingAdminReview:
      postDelivery &&
      disputeByBuyer &&
      canAdminResolvePostDeliveryDispute(dispute),
    disputeReason: legacyReason,
    disputeReasonLabel: disputeReasonTypeLabel(reasonType),
    disputeDescription: primaryComplaint?.content || "",
    disputedAt,
    disputeFirstBy,
    buyerDisputedAt: buyerAt,
    sellerDisputedAt: sellerAt,
    disputeRecord: dispute,
  };
}

async function loadDisputeForReservation(reservationId) {
  if (!reservationId) {
    return null;
  }
  return ReservationDispute.findOne({ reservationId }).lean();
}

async function loadDisputesByReservationIds(reservationIds = []) {
  const ids = [...new Set(reservationIds.filter(Boolean).map((id) => String(id)))];
  if (!ids.length) {
    return new Map();
  }
  const rows = await ReservationDispute.find({ reservationId: { $in: ids } }).lean();
  return new Map(rows.map((row) => [String(row.reservationId), row]));
}

async function resolveSellerIdForReservation(reservation) {
  if (reservation?.sellerId) {
    return reservation.sellerId;
  }
  if (!reservation?.shopId) {
    return null;
  }
  const shop = await ShopProfile.findById(reservation.shopId).select("userId").lean();
  return shop?.userId || null;
}

async function resolveDisputeUserId(reservation, party, explicitUserId) {
  if (explicitUserId) {
    return explicitUserId;
  }
  if (party === "buyer") {
    return getReservationBuyerId(reservation);
  }
  return resolveSellerIdForReservation(reservation);
}

async function upsertPartyComplaint({
  reservation,
  party,
  userId,
  shopId,
  reason = "",
  reasonType,
  content = "",
  description = "",
  images = [],
}) {
  const partyKey = party === "seller" ? "seller" : "buyer";
  if (partyKey !== "buyer" && partyKey !== "seller") {
    throw new Error("party phải là buyer hoặc seller.");
  }

  const map = fieldMap(partyKey);
  const now = new Date();
  const patch =
    partyKey === "seller"
      ? {
          [map.shopId]: shopId || reservation.shopId || null,
          [map.reasonType]: normalizeDisputeReasonType(reasonType ?? reason),
          [map.content]: pickString(content || description),
          [map.images]: normalizeEmbeddedImages(images),
          [map.createdAt]: now,
        }
      : {
          [map.userId]: userId || getReservationBuyerId(reservation),
          [map.reasonType]: normalizeDisputeReasonType(reasonType ?? reason),
          [map.content]: pickString(content || description),
          [map.images]: normalizeEmbeddedImages(images),
          [map.createdAt]: now,
        };

  if (partyKey === "seller" && !patch[map.shopId]) {
    const error = new Error("Không xác định được gian hàng của đơn giữ hàng.");
    error.statusCode = 400;
    throw error;
  }

  let dispute = await ReservationDispute.findOne({ reservationId: reservation._id });
  if (dispute) {
    if (partyHasComplaint(dispute, partyKey)) {
      const error = new Error(
        partyKey === "buyer" ? "Buyer đã gửi khiếu nại cho đơn này." : "Shop đã gửi khiếu nại cho đơn này."
      );
      error.statusCode = 409;
      throw error;
    }
    Object.assign(dispute, patch);
    dispute.updatedAt = now;
    await dispute.save();
    return dispute;
  }

  return ReservationDispute.create({
    reservationId: reservation._id,
    ...patch,
    status: DISPUTE_STATUS.PENDING,
    auditLogs: [],
    createdAt: now,
    updatedAt: now,
  });
}

/** @deprecated Dùng upsertPartyComplaint */
async function createReservationDispute(args) {
  return upsertPartyComplaint({
    ...args,
    party: args.createdBy === "seller" || args.createdBy === DISPUTE_CREATED_BY.SELLER ? "seller" : "buyer",
  });
}

async function appendDisputeAuditLog(dispute, { adminId, action, decision, note }) {
  if (!dispute) {
    return null;
  }
  const entry = {
    adminId,
    action,
    decision: pickString(decision),
    note: pickString(note),
    createdAt: new Date(),
  };
  dispute.auditLogs = Array.isArray(dispute.auditLogs) ? dispute.auditLogs : [];
  dispute.auditLogs.push(entry);
  dispute.updatedAt = new Date();
  await dispute.save();
  return entry;
}

const { RESERVATION_STATUS } = require("../constants");

async function markReservationDisputed(reservation, { now = new Date() } = {}) {
  reservation.status = RESERVATION_STATUS.DISPUTED;
  reservation.hasDispute = true;
  reservation.updatedAt = now;
  await reservation.save();
}

module.exports = {
  getPartyComplaint,
  partyHasComplaint,
  disputeViewFromRecord,
  loadDisputeForReservation,
  loadDisputesByReservationIds,
  resolveSellerIdForReservation,
  upsertPartyComplaint,
  createReservationDispute,
  appendDisputeAuditLog,
  markReservationDisputed,
  resolveComplaintTitle,
};

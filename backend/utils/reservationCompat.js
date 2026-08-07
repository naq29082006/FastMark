const { DISPUTE_CREATED_BY } = require("../constants");

function pickString(value) {
  return String(value || "").trim();
}

function getReservationBuyerId(reservation) {
  return reservation?.buyerId || reservation?.userId || null;
}

function getReservationSellerId(reservation) {
  return reservation?.sellerId || null;
}

function reservationHasDispute(reservation) {
  if (reservation?.hasDispute === true || reservation?.disputed === true) {
    return true;
  }
  return Number(reservation?.hasDispute) === 1 || Number(reservation?.disputed) === 1;
}

function reservationHasReview(reservation) {
  if (reservation?.hasReview === true || reservation?.hasReviewed === true) {
    return true;
  }
  return Number(reservation?.hasReview) === 1 || Number(reservation?.hasReviewed) === 1;
}

function getReservationCreatedAt(reservation) {
  return reservation?.createdAt || reservation?.CreatedAt || null;
}

function getReservationUpdatedAt(reservation) {
  return reservation?.updatedAt || reservation?.UpdatedAt || null;
}

function buyerIdFilter(userId) {
  const id = pickString(userId);
  if (!id) {
    return {};
  }
  return { $or: [{ buyerId: id }, { userId: id }] };
}

function hasDisputeFilter() {
  return { $or: [{ hasDispute: true }, { disputed: true }] };
}

function noDisputeFilter() {
  return {
    $and: [
      { $or: [{ hasDispute: false }, { hasDispute: { $exists: false } }] },
      { $or: [{ disputed: false }, { disputed: { $exists: false } }] },
    ],
  };
}

function normalizeDisputeCreatedBy(value) {
  const raw = pickString(value).toLowerCase();
  if (raw === "buyer" || Number(value) === DISPUTE_CREATED_BY.BUYER) {
    return DISPUTE_CREATED_BY.BUYER;
  }
  if (raw === "seller" || Number(value) === DISPUTE_CREATED_BY.SELLER) {
    return DISPUTE_CREATED_BY.SELLER;
  }
  return null;
}

function disputeCreatedByLabel(createdBy) {
  const code = Number(createdBy);
  if (code === DISPUTE_CREATED_BY.BUYER) {
    return "buyer";
  }
  if (code === DISPUTE_CREATED_BY.SELLER) {
    return "seller";
  }
  return "";
}

function generatePickupCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = {
  getReservationBuyerId,
  getReservationSellerId,
  reservationHasDispute,
  reservationHasReview,
  getReservationCreatedAt,
  getReservationUpdatedAt,
  buyerIdFilter,
  hasDisputeFilter,
  noDisputeFilter,
  normalizeDisputeCreatedBy,
  disputeCreatedByLabel,
  generatePickupCode,
};

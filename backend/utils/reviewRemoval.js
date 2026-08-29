const { RECORD_STATUS, REVIEW_REMOVED_BY } = require("../constants");

function pickString(value) {
  return String(value || "").trim();
}

function isLegacyBooleanDeleted(value) {
  return value === true;
}

function resolveReviewRemovedBy(review) {
  const removedBy = pickString(review?.removedBy).toLowerCase();
  if (removedBy === REVIEW_REMOVED_BY.ADMIN || removedBy === REVIEW_REMOVED_BY.BUYER) {
    return removedBy;
  }

  if (Number(review?.isHidden) === 1 || review?.isHidden === true) {
    return REVIEW_REMOVED_BY.ADMIN;
  }

  if (Number(review?.isDeleted) === RECORD_STATUS.HIDDEN || isLegacyBooleanDeleted(review?.isDeleted)) {
    return pickString(review?.lyDoGo || review?.adminRemovalReason || review?.moderationReason)
      ? REVIEW_REMOVED_BY.ADMIN
      : REVIEW_REMOVED_BY.BUYER;
  }

  return "";
}

function isReviewSoftDeleted(review) {
  const value = review?.isDeleted;
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  return Number(value) === RECORD_STATUS.HIDDEN;
}

function isAdminHiddenReview(review) {
  return (
    !isReviewSoftDeleted(review) &&
    resolveReviewRemovedBy(review) === REVIEW_REMOVED_BY.ADMIN
  );
}

function isReviewHidden(review) {
  return isAdminHiddenReview(review);
}

function isReviewActive(review) {
  return !isReviewSoftDeleted(review);
}

function isRemovedReview(review) {
  return isReviewSoftDeleted(review) || isAdminHiddenReview(review);
}

function isAdminRemovedReview(review) {
  return resolveReviewRemovedBy(review) === REVIEW_REMOVED_BY.ADMIN;
}

function isBuyerRemovedReview(review) {
  return resolveReviewRemovedBy(review) === REVIEW_REMOVED_BY.BUYER;
}

function resolveReviewRemovedAt(review) {
  return review?.removedAt || review?.deletedAt || null;
}

function resolveReviewLyDoGo(review) {
  return pickString(review?.lyDoGo || review?.adminRemovalReason || review?.moderationReason);
}

function toAdminReviewRemovalFields(review) {
  const removedAt = resolveReviewRemovedAt(review);
  const removedBy = resolveReviewRemovedBy(review);
  return {
    isDeleted: isReviewSoftDeleted(review),
    isHidden: isAdminHiddenReview(review),
    isAdminRemoved: isAdminRemovedReview(review),
    isBuyerRemoved: isBuyerRemovedReview(review),
    removedBy,
    removedAt,
    lyDoGo: resolveReviewLyDoGo(review),
  };
}

function notDeletedReviewFilter(field = "isDeleted") {
  const activeValues = [RECORD_STATUS.ACTIVE, false, "1"];
  return {
    $or: [
      { $expr: { $in: [`$${field}`, activeValues] } },
      { [field]: { $exists: false } },
    ],
  };
}

function deletedReviewFilter(field = "isDeleted") {
  const deletedValues = [RECORD_STATUS.HIDDEN, true, "0"];
  return {
    $or: [{ $expr: { $in: [`$${field}`, deletedValues] } }],
  };
}

function notAdminHiddenReviewFilter(field = "removedBy") {
  return {
    $or: [
      { [field]: { $in: ["", null] } },
      { [field]: { $exists: false } },
      { [field]: REVIEW_REMOVED_BY.BUYER },
    ],
  };
}

function adminHiddenReviewFilter(field = "removedBy") {
  return { [field]: REVIEW_REMOVED_BY.ADMIN };
}

function publicReviewFilter() {
  return {
    $and: [notDeletedReviewFilter(), notAdminHiddenReviewFilter()],
  };
}

function visibleReviewMatch() {
  return publicReviewFilter();
}

function emptyRemovedByMatch(field = "removedBy") {
  return {
    $or: [{ [field]: "" }, { [field]: null }, { [field]: { $exists: false } }],
  };
}

function adminDeletedReviewFilter() {
  return {
    $and: [
      deletedReviewFilter(),
      {
        $or: [
          { removedBy: REVIEW_REMOVED_BY.ADMIN },
          {
            $and: [
              emptyRemovedByMatch(),
              { lyDoGo: { $exists: true, $nin: ["", null] } },
            ],
          },
        ],
      },
    ],
  };
}

function buyerDeletedReviewFilter() {
  return {
    $and: [
      deletedReviewFilter(),
      {
        $or: [
          { removedBy: REVIEW_REMOVED_BY.BUYER },
          {
            $and: [
              emptyRemovedByMatch(),
              {
                $or: [{ lyDoGo: { $exists: false } }, { lyDoGo: "" }, { lyDoGo: null }],
              },
            ],
          },
        ],
      },
    ],
  };
}

function activeReviewPartialFilter(field = "isDeleted") {
  return notDeletedReviewFilter(field);
}

function clearReviewRemoval(review) {
  review.isDeleted = RECORD_STATUS.ACTIVE;
  review.removedBy = "";
  review.lyDoGo = "";
  review.removedAt = null;
}

function markReviewAdminHidden(review, reason, removedAt = new Date()) {
  review.isDeleted = RECORD_STATUS.ACTIVE;
  review.removedBy = REVIEW_REMOVED_BY.ADMIN;
  review.lyDoGo = pickString(reason);
  review.removedAt = removedAt;
}

function markReviewAdminDeleted(review, reason, removedAt = new Date()) {
  review.isDeleted = RECORD_STATUS.HIDDEN;
  review.removedBy = REVIEW_REMOVED_BY.ADMIN;
  review.lyDoGo = pickString(reason);
  review.removedAt = removedAt;
}

function markReviewBuyerDeleted(review, removedAt = new Date()) {
  review.isDeleted = RECORD_STATUS.HIDDEN;
  review.removedBy = REVIEW_REMOVED_BY.BUYER;
  review.lyDoGo = "";
  review.removedAt = removedAt;
}

/** @deprecated Dùng markReviewAdminDeleted / markReviewBuyerDeleted */
function markReviewDeleted(review, removedAt = new Date(), removedBy = REVIEW_REMOVED_BY.BUYER) {
  if (removedBy === REVIEW_REMOVED_BY.ADMIN) {
    markReviewAdminDeleted(review, review?.lyDoGo || review?.adminRemovalReason || review?.moderationReason || "", removedAt);
    return;
  }
  markReviewBuyerDeleted(review, removedAt);
}

function setReviewHiddenFlag(review, hidden) {
  if (!hidden) {
    if (isAdminHiddenReview(review) && !isReviewSoftDeleted(review)) {
      clearReviewRemoval(review);
    }
    return;
  }
  markReviewAdminHidden(review, review?.lyDoGo || review?.adminRemovalReason || review?.moderationReason || "Ẩn bởi quản trị viên");
}

module.exports = {
  isReviewSoftDeleted,
  isReviewDeleted: isReviewSoftDeleted,
  isReviewActive,
  isReviewHidden,
  isAdminHiddenReview,
  isRemovedReview,
  isAdminRemovedReview,
  isBuyerRemovedReview,
  resolveReviewRemovedBy,
  resolveReviewRemovedAt,
  resolveReviewLyDoGo,
  toAdminReviewRemovalFields,
  notDeletedReviewFilter,
  deletedReviewFilter,
  notAdminHiddenReviewFilter,
  adminHiddenReviewFilter,
  publicReviewFilter,
  visibleReviewMatch,
  adminDeletedReviewFilter,
  buyerDeletedReviewFilter,
  activeReviewPartialFilter,
  clearReviewRemoval,
  markReviewAdminHidden,
  markReviewAdminDeleted,
  markReviewBuyerDeleted,
  markReviewDeleted,
  setReviewHiddenFlag,
};

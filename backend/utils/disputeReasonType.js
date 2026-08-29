const { DISPUTE_REASON_TYPE } = require("../constants");

const LEGACY_STRING_TO_TYPE = {
  seller_absent: DISPUTE_REASON_TYPE.SHOP_NOT_FOUND,
  shop_not_found: DISPUTE_REASON_TYPE.SHOP_NOT_FOUND,
  shop_closed: DISPUTE_REASON_TYPE.SHOP_CLOSED,
  shop_out_of_stock: DISPUTE_REASON_TYPE.OUT_OF_STOCK,
  seller_no_delivery: DISPUTE_REASON_TYPE.OUT_OF_STOCK,
  shop_no_delivery: DISPUTE_REASON_TYPE.OUT_OF_STOCK,
  wrong_item: DISPUTE_REASON_TYPE.WRONG_PRODUCT,
  damaged_item: DISPUTE_REASON_TYPE.DAMAGED_PRODUCT,
  missing_item: DISPUTE_REASON_TYPE.DAMAGED_PRODUCT,
  not_as_described: DISPUTE_REASON_TYPE.WRONG_PRODUCT,
  expired: DISPUTE_REASON_TYPE.DAMAGED_PRODUCT,
  buyer_no_show: DISPUTE_REASON_TYPE.BUYER_NO_SHOW,
  other: DISPUTE_REASON_TYPE.OTHER,
};

const TYPE_TO_LEGACY_STRING = Object.entries(LEGACY_STRING_TO_TYPE).reduce(
  (map, [key, value]) => {
    if (!map[value]) {
      map[value] = key;
    }
    return map;
  },
  {}
);

function normalizeDisputeReasonType(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  const raw = String(value || "").trim().toLowerCase();
  return LEGACY_STRING_TO_TYPE[raw] || DISPUTE_REASON_TYPE.OTHER;
}

function disputeReasonTypeLabel(reasonType) {
  const { DISPUTE_REASON_TYPE_LABEL } = require("../constants");
  return DISPUTE_REASON_TYPE_LABEL[Number(reasonType)] || "Khác";
}

function disputeReasonLegacyString(reasonType) {
  return TYPE_TO_LEGACY_STRING[Number(reasonType)] || "other";
}

module.exports = {
  normalizeDisputeReasonType,
  disputeReasonTypeLabel,
  disputeReasonLegacyString,
  LEGACY_STRING_TO_TYPE,
};

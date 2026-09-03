const SellerVerification = require("../models/SellerVerification");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");
const { SELLER_VERIFICATION_STATUS, USER_ROLE } = require("../constants");

const PENDING_REVIEW_MESSAGE =
  "Hồ sơ xác thực của gian hàng đang được xét duyệt lại. Bạn tạm thời không thể bán hàng cho đến khi được phê duyệt.";

const META_TYPE = {
  ATTP: "attp_meta",
  RE_REVIEW_PENDING: "re_review_pending",
  RE_REVIEW_REJECTED: "re_review_rejected",
};

function safeParseJson(raw) {
  const text = String(raw || "").trim();
  if (!text.startsWith("{")) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildAttpMeta({
  licenseNumber = "",
  issuedAt = "",
  expiresAt = "",
  extraDocUrls = [],
  lastReReviewRejection = null,
} = {}) {
  const payload = {
    type: META_TYPE.ATTP,
    licenseNumber: String(licenseNumber || "").trim(),
    issuedAt: String(issuedAt || "").trim(),
    expiresAt: String(expiresAt || "").trim(),
    extraDocUrls: Array.isArray(extraDocUrls)
      ? extraDocUrls.map((url) => String(url || "").trim()).filter(Boolean)
      : [],
  };
  if (lastReReviewRejection?.reason) {
    payload.lastReReviewRejection = {
      reason: String(lastReReviewRejection.reason || "").trim(),
      rejectedAt: lastReReviewRejection.rejectedAt || new Date().toISOString(),
    };
  }
  return payload;
}

function buildReReviewPendingMeta({
  changeReason,
  licenseNumber,
  issuedAt,
  expiresAt,
  extraDocUrls = [],
  previousSnapshot,
} = {}) {
  return {
    type: META_TYPE.RE_REVIEW_PENDING,
    changeReason: String(changeReason || "").trim(),
    licenseNumber: String(licenseNumber || "").trim(),
    issuedAt: String(issuedAt || "").trim(),
    expiresAt: String(expiresAt || "").trim(),
    extraDocUrls: Array.isArray(extraDocUrls)
      ? extraDocUrls.map((url) => String(url || "").trim()).filter(Boolean)
      : [],
    submittedAt: new Date().toISOString(),
    previousSnapshot: previousSnapshot || null,
  };
}

function parseVerificationMeta(lyDoTuChoi) {
  const parsed = safeParseJson(lyDoTuChoi);
  if (!parsed || typeof parsed !== "object") {
    return {
      type: "plain_text",
      plainText: String(lyDoTuChoi || "").trim(),
      attpMeta: null,
      reReviewPending: null,
    };
  }

  if (parsed.type === META_TYPE.RE_REVIEW_PENDING) {
    return {
      type: parsed.type,
      plainText: "",
      attpMeta: null,
      reReviewPending: parsed,
    };
  }

  if (parsed.type === META_TYPE.ATTP || parsed.type === META_TYPE.RE_REVIEW_REJECTED) {
    return {
      type: parsed.type,
      plainText: parsed.reason || "",
      attpMeta: parsed,
      reReviewPending: null,
    };
  }

  return {
    type: "unknown_json",
    plainText: String(lyDoTuChoi || "").trim(),
    attpMeta: parsed,
    reReviewPending: null,
  };
}

function buildSnapshotFromVerification(verification, meta = null) {
  const parsed = meta || parseVerificationMeta(verification?.LyDoTuChoi);
  const attp = parsed.attpMeta || parsed.reReviewPending || {};
  return {
    anhKD: verification?.anhKD || "",
    licenseNumber: attp.licenseNumber || "",
    issuedAt: attp.issuedAt || "",
    expiresAt: attp.expiresAt || "",
    extraDocUrls: Array.isArray(attp.extraDocUrls) ? [...attp.extraDocUrls] : [],
  };
}

function applySnapshotToVerification(verification, snapshot = {}) {
  if (!verification || !snapshot) {
    return verification;
  }
  if (snapshot.anhKD) {
    verification.anhKD = snapshot.anhKD;
  }
  verification.LyDoTuChoi = JSON.stringify(
    buildAttpMeta({
      licenseNumber: snapshot.licenseNumber,
      issuedAt: snapshot.issuedAt,
      expiresAt: snapshot.expiresAt,
      extraDocUrls: snapshot.extraDocUrls,
    })
  );
  return verification;
}

function isPendingReReviewVerification(verification, user) {
  if (!verification || !user) {
    return false;
  }
  if (Number(verification.status) !== SELLER_VERIFICATION_STATUS.PENDING) {
    return false;
  }
  if (Number(user.Role) !== USER_ROLE.SELLER) {
    return false;
  }
  const meta = parseVerificationMeta(verification.LyDoTuChoi);
  return meta.type === META_TYPE.RE_REVIEW_PENDING;
}

async function isShopOwnerPendingReReview(userId) {
  if (!userId) {
    return false;
  }
  const user = await User.findById(userId).select("Role").lean();
  if (!user || Number(user.Role) !== USER_ROLE.SELLER) {
    return false;
  }
  const shop = await ShopProfile.findOne({ userId }).select("_id").lean();
  if (!shop) {
    return false;
  }
  const verification = await SellerVerification.findOne({ userId })
    .sort({ CreatedAt: -1 })
    .select("status LyDoTuChoi")
    .lean();
  if (!verification) {
    return false;
  }
  if (Number(verification.status) !== SELLER_VERIFICATION_STATUS.PENDING) {
    return false;
  }
  const meta = parseVerificationMeta(verification.LyDoTuChoi);
  return meta.type === META_TYPE.RE_REVIEW_PENDING;
}

async function loadAttpResubmitRequiredUserIdSet(userIds = []) {
  const normalized = [...new Set(userIds.map((id) => String(id)).filter(Boolean))];
  if (!normalized.length) {
    return new Set();
  }

  const rows = await SellerVerification.find({
    userId: { $in: normalized },
    status: SELLER_VERIFICATION_STATUS.APPROVED,
    LyDoTuChoi: /lastReReviewRejection/,
  })
    .select("userId LyDoTuChoi")
    .lean();

  const blocked = new Set();
  for (const row of rows) {
    const meta = parseVerificationMeta(row.LyDoTuChoi);
    if (meta.type === META_TYPE.ATTP && attpMetaRequiresResubmit(meta.attpMeta)) {
      blocked.add(String(row.userId));
    }
  }
  return blocked;
}

async function loadPendingReReviewUserIdSet(userIds = []) {
  const normalized = [...new Set(userIds.map((id) => String(id)).filter(Boolean))];
  if (!normalized.length) {
    return new Set();
  }

  const rows = await SellerVerification.find({
    userId: { $in: normalized },
    status: SELLER_VERIFICATION_STATUS.PENDING,
  })
    .select("userId LyDoTuChoi")
    .lean();

  const blocked = new Set();
  for (const row of rows) {
    const meta = parseVerificationMeta(row.LyDoTuChoi);
    if (meta.type === META_TYPE.RE_REVIEW_PENDING) {
      blocked.add(String(row.userId));
    }
  }
  return blocked;
}

function createBlockedError() {
  const error = new Error(PENDING_REVIEW_MESSAGE);
  error.statusCode = 403;
  return error;
}

async function assertShopOwnerCanSell(userId) {
  if (await isShopOwnerPendingReReview(userId)) {
    throw createBlockedError();
  }
  if (await shopRequiresAttpReApproval(userId)) {
    const error = new Error(
      "Giấy phép ATTP chưa được duyệt. Vui lòng gửi lại hồ sơ xác thực trong Cài đặt shop."
    );
    error.statusCode = 403;
    throw error;
  }
}

function parseAttpDateString(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (dmy) {
    const parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoLike = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoLike) {
    const parsed = new Date(Number(isoLike[1]), Number(isoLike[2]) - 1, Number(isoLike[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getApprovedAttpMeta(verification) {
  if (!verification || Number(verification.status) !== SELLER_VERIFICATION_STATUS.APPROVED) {
    return null;
  }
  const meta = parseVerificationMeta(verification.LyDoTuChoi);
  if (meta.type !== META_TYPE.ATTP || !meta.attpMeta) {
    return null;
  }
  return meta.attpMeta;
}

function attpMetaRequiresResubmit(attpMeta) {
  return Boolean(attpMeta?.lastReReviewRejection?.reason);
}

async function shopRequiresAttpReApproval(userId) {
  if (!userId) {
    return false;
  }
  const verification = await SellerVerification.findOne({
    userId,
    status: SELLER_VERIFICATION_STATUS.APPROVED,
  })
    .select("status LyDoTuChoi")
    .lean();
  const attpMeta = getApprovedAttpMeta(verification);
  return attpMetaRequiresResubmit(attpMeta);
}

function isAttpExpired(attpMeta, now = new Date()) {
  if (!attpMeta?.expiresAt) {
    return false;
  }
  const expiryDate = parseAttpDateString(attpMeta.expiresAt);
  if (!expiryDate) {
    return false;
  }
  const endOfDay = new Date(expiryDate);
  endOfDay.setHours(23, 59, 59, 999);
  return now > endOfDay;
}

function enrichPublicVerification(verification, user = null) {
  if (!verification) {
    return null;
  }
  const meta = parseVerificationMeta(verification.LyDoTuChoi);
  const attpSource =
    meta.reReviewPending ||
    meta.attpMeta ||
    (meta.type === META_TYPE.ATTP ? meta.attpMeta : null);
  const pendingReReview = isPendingReReviewVerification(verification, user);
  const approvedAttp = getApprovedAttpMeta(verification);
  const attpExpired =
    Boolean(approvedAttp?.expiresAt) &&
    isAttpExpired(approvedAttp) &&
    !pendingReReview;
  const attpResubmitRequired =
    attpMetaRequiresResubmit(approvedAttp) && !pendingReReview;

  return {
    attpMeta: attpSource
      ? {
          licenseNumber: attpSource.licenseNumber || "",
          issuedAt: attpSource.issuedAt || "",
          expiresAt: attpSource.expiresAt || "",
          extraDocUrls: attpSource.extraDocUrls || [],
          lastReReviewRejection: approvedAttp?.lastReReviewRejection || null,
        }
      : null,
    attpExpiresAt: approvedAttp?.expiresAt || attpSource?.expiresAt || "",
    attpIssuedAt: approvedAttp?.issuedAt || attpSource?.issuedAt || "",
    isAttpExpired: attpExpired,
    isAttpResubmitRequired: attpResubmitRequired,
    isPendingReReview: pendingReReview,
    pendingReReviewLabel: pendingReReview ? "Đang chờ duyệt lại" : "",
    reReviewChangeReason: meta.reReviewPending?.changeReason || "",
    reReviewSubmittedAt: meta.reReviewPending?.submittedAt || null,
    reReviewPreviousSnapshot: meta.reReviewPending?.previousSnapshot || null,
    rejectionReasonPlain:
      meta.type === "plain_text" ? meta.plainText : meta.attpMeta?.lastReReviewRejection?.reason || "",
  };
}

module.exports = {
  PENDING_REVIEW_MESSAGE,
  META_TYPE,
  parseVerificationMeta,
  parseAttpDateString,
  getApprovedAttpMeta,
  attpMetaRequiresResubmit,
  shopRequiresAttpReApproval,
  isAttpExpired,
  buildAttpMeta,
  buildReReviewPendingMeta,
  buildSnapshotFromVerification,
  applySnapshotToVerification,
  isPendingReReviewVerification,
  isShopOwnerPendingReReview,
  loadPendingReReviewUserIdSet,
  loadAttpResubmitRequiredUserIdSet,
  assertShopOwnerCanSell,
  enrichPublicVerification,
};

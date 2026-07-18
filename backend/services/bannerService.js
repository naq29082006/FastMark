const Banner = require("../models/Banner");
const { BANNER_TARGET_TYPE, BANNER_STATUS } = require("../constants/banner");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPublicBanner(doc) {
  return {
    id: String(doc._id),
    title: doc.title || "",
    image: doc.image || "",
    description: doc.description || "",
    targetType: Number(doc.targetType) || BANNER_TARGET_TYPE.PROMOTION,
    targetId: doc.targetId || "",
    priority: Number(doc.priority) || 0,
    status: Number(doc.status),
    startDate: doc.startDate || null,
    endDate: doc.endDate || null,
    createdAt: doc.CreatedAt,
  };
}

function isBannerActiveNow(doc, now = new Date()) {
  if (Number(doc.status) !== BANNER_STATUS.ACTIVE) {
    return false;
  }
  if (doc.startDate && new Date(doc.startDate) > now) {
    return false;
  }
  if (doc.endDate && new Date(doc.endDate) < now) {
    return false;
  }
  return true;
}

async function listActiveBanners({ limit = 10 } = {}) {
  const rows = await Banner.find({ status: BANNER_STATUS.ACTIVE })
    .sort({ priority: -1, CreatedAt: -1 })
    .limit(40);
  const now = new Date();
  return rows
    .filter((row) => isBannerActiveNow(row, now))
    .slice(0, Math.min(20, Number(limit) || 10))
    .map(toPublicBanner);
}

async function listAdminBanners() {
  const rows = await Banner.find({}).sort({ priority: -1, CreatedAt: -1 }).limit(100);
  return rows.map(toPublicBanner);
}

async function createBanner(payload) {
  const title = String(payload.title || "").trim();
  if (!title) {
    throw createServiceError("Thiếu tiêu đề banner.");
  }

  const banner = await Banner.create({
    title,
    image: String(payload.image || "").trim(),
    description: String(payload.description || "").trim(),
    targetType: Number(payload.targetType) || BANNER_TARGET_TYPE.PROMOTION,
    targetId: String(payload.targetId || "").trim(),
    priority: Number(payload.priority) || 0,
    status:
      payload.status === undefined || Number(payload.status) === BANNER_STATUS.ACTIVE
        ? BANNER_STATUS.ACTIVE
        : BANNER_STATUS.INACTIVE,
    startDate: payload.startDate ? new Date(payload.startDate) : null,
    endDate: payload.endDate ? new Date(payload.endDate) : null,
  });

  return toPublicBanner(banner);
}

async function updateBanner(bannerId, payload) {
  const banner = await Banner.findById(bannerId);
  if (!banner) {
    throw createServiceError("Không tìm thấy banner.", 404);
  }

  if (payload.title !== undefined) {
    const title = String(payload.title || "").trim();
    if (!title) throw createServiceError("Thiếu tiêu đề banner.");
    banner.title = title;
  }
  if (payload.image !== undefined) banner.image = String(payload.image || "").trim();
  if (payload.description !== undefined) {
    banner.description = String(payload.description || "").trim();
  }
  if (payload.targetType !== undefined) {
    banner.targetType = Number(payload.targetType) || banner.targetType;
  }
  if (payload.targetId !== undefined) banner.targetId = String(payload.targetId || "").trim();
  if (payload.priority !== undefined) banner.priority = Number(payload.priority) || 0;
  if (payload.status !== undefined) {
    banner.status =
      Number(payload.status) === BANNER_STATUS.ACTIVE
        ? BANNER_STATUS.ACTIVE
        : BANNER_STATUS.INACTIVE;
  }
  if (payload.startDate !== undefined) {
    banner.startDate = payload.startDate ? new Date(payload.startDate) : null;
  }
  if (payload.endDate !== undefined) {
    banner.endDate = payload.endDate ? new Date(payload.endDate) : null;
  }

  await banner.save();
  return toPublicBanner(banner);
}

async function deleteBanner(bannerId) {
  const result = await Banner.deleteOne({ _id: bannerId });
  if (!result.deletedCount) {
    throw createServiceError("Không tìm thấy banner.", 404);
  }
  return { deleted: true };
}

module.exports = {
  listActiveBanners,
  listAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toPublicBanner,
};

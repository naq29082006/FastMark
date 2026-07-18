const Voucher = require("../models/Voucher");
const ShopProfile = require("../models/ShopProfile");
const { VOUCHER_DISCOUNT_TYPE, VOUCHER_STATUS } = require("../constants/voucher");
const { getShopForSeller } = require("./shopSettingsService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPublicVoucher(doc, shop = null) {
  return {
    id: String(doc._id),
    shopId: doc.shopId ? String(doc.shopId) : "",
    shopName: shop?.shopName || "",
    code: doc.code || "",
    title: doc.title || "",
    description: doc.description || "",
    discountType: Number(doc.discountType) || VOUCHER_DISCOUNT_TYPE.PERCENT,
    discountValue: Number(doc.discountValue) || 0,
    minOrderAmount: Number(doc.minOrderAmount) || 0,
    maxDiscount: Number(doc.maxDiscount) || 0,
    quantity: Number(doc.quantity) || 0,
    usedCount: Number(doc.usedCount) || 0,
    startDate: doc.startDate || null,
    endDate: doc.endDate || null,
    status: Number(doc.status),
    createdAt: doc.CreatedAt,
  };
}

function isVoucherActiveNow(doc, now = new Date()) {
  if (Number(doc.status) !== VOUCHER_STATUS.ON) {
    return false;
  }
  if (doc.startDate && new Date(doc.startDate) > now) {
    return false;
  }
  if (doc.endDate && new Date(doc.endDate) < now) {
    return false;
  }
  if (Number(doc.quantity) > 0 && Number(doc.usedCount) >= Number(doc.quantity)) {
    return false;
  }
  return true;
}

async function listSellerVouchers(user) {
  const shop = await getShopForSeller(user);
  const rows = await Voucher.find({ shopId: shop._id }).sort({ CreatedAt: -1 }).limit(100);
  return rows.map((row) => toPublicVoucher(row, shop));
}

async function createSellerVoucher(user, payload) {
  const shop = await getShopForSeller(user);
  const code = String(payload.code || "")
    .trim()
    .toUpperCase();
  if (!code || code.length < 3) {
    throw createServiceError("Mã voucher phải từ 3 ký tự.");
  }

  const discountType = Number(payload.discountType) || VOUCHER_DISCOUNT_TYPE.PERCENT;
  const discountValue = Number(payload.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw createServiceError("Giá trị giảm không hợp lệ.");
  }

  const voucher = await Voucher.create({
    shopId: shop._id,
    code,
    title: String(payload.title || code).trim(),
    description: String(payload.description || "").trim(),
    discountType,
    discountValue,
    minOrderAmount: Math.max(0, Number(payload.minOrderAmount) || 0),
    maxDiscount: Math.max(0, Number(payload.maxDiscount) || 0),
    quantity: Math.max(0, Number(payload.quantity) || 0),
    startDate: payload.startDate ? new Date(payload.startDate) : null,
    endDate: payload.endDate ? new Date(payload.endDate) : null,
    status:
      payload.status === undefined || payload.status === null
        ? VOUCHER_STATUS.ON
        : Number(payload.status) === VOUCHER_STATUS.ON
          ? VOUCHER_STATUS.ON
          : VOUCHER_STATUS.OFF,
  });

  return toPublicVoucher(voucher, shop);
}

async function updateSellerVoucher(user, voucherId, payload) {
  const shop = await getShopForSeller(user);
  const voucher = await Voucher.findOne({ _id: voucherId, shopId: shop._id });
  if (!voucher) {
    throw createServiceError("Không tìm thấy voucher.", 404);
  }

  if (payload.title !== undefined) voucher.title = String(payload.title || "").trim();
  if (payload.description !== undefined) {
    voucher.description = String(payload.description || "").trim();
  }
  if (payload.discountValue !== undefined) {
    const value = Number(payload.discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      throw createServiceError("Giá trị giảm không hợp lệ.");
    }
    voucher.discountValue = value;
  }
  if (payload.discountType !== undefined) {
    voucher.discountType = Number(payload.discountType) || voucher.discountType;
  }
  if (payload.minOrderAmount !== undefined) {
    voucher.minOrderAmount = Math.max(0, Number(payload.minOrderAmount) || 0);
  }
  if (payload.maxDiscount !== undefined) {
    voucher.maxDiscount = Math.max(0, Number(payload.maxDiscount) || 0);
  }
  if (payload.quantity !== undefined) {
    voucher.quantity = Math.max(0, Number(payload.quantity) || 0);
  }
  if (payload.status !== undefined) {
    voucher.status =
      Number(payload.status) === VOUCHER_STATUS.ON ? VOUCHER_STATUS.ON : VOUCHER_STATUS.OFF;
  }
  if (payload.startDate !== undefined) {
    voucher.startDate = payload.startDate ? new Date(payload.startDate) : null;
  }
  if (payload.endDate !== undefined) {
    voucher.endDate = payload.endDate ? new Date(payload.endDate) : null;
  }

  await voucher.save();
  return toPublicVoucher(voucher, shop);
}

async function deleteSellerVoucher(user, voucherId) {
  const shop = await getShopForSeller(user);
  const result = await Voucher.deleteOne({ _id: voucherId, shopId: shop._id });
  if (!result.deletedCount) {
    throw createServiceError("Không tìm thấy voucher.", 404);
  }
  return { deleted: true };
}

async function listShopActiveVouchers(shopId) {
  if (!shopId) {
    return [];
  }
  const shop = await ShopProfile.findById(shopId);
  const rows = await Voucher.find({ shopId, status: VOUCHER_STATUS.ON })
    .sort({ CreatedAt: -1 })
    .limit(50);
  const now = new Date();
  return rows.filter((row) => isVoucherActiveNow(row, now)).map((row) => toPublicVoucher(row, shop));
}

async function listNearbyActiveVouchers({ limit = 12 } = {}) {
  const rows = await Voucher.find({ status: VOUCHER_STATUS.ON })
    .sort({ CreatedAt: -1 })
    .limit(Math.min(40, Number(limit) * 3 || 36));
  const now = new Date();
  const active = rows.filter((row) => isVoucherActiveNow(row, now)).slice(0, limit);
  const shopIds = [...new Set(active.map((row) => String(row.shopId)))];
  const shops = await ShopProfile.find({ _id: { $in: shopIds } });
  const shopMap = new Map(shops.map((shop) => [String(shop._id), shop]));
  return active.map((row) => toPublicVoucher(row, shopMap.get(String(row.shopId))));
}

module.exports = {
  listSellerVouchers,
  createSellerVoucher,
  updateSellerVoucher,
  deleteSellerVoucher,
  listShopActiveVouchers,
  listNearbyActiveVouchers,
  toPublicVoucher,
};

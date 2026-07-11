const Report = require("../models/Report");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const Restaurant = require("../models/Restaurant");
const { REPORT_STATUS } = require("../constants/reportStatus");
const { REPORT_TYPE } = require("../constants/reportType");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function isStrictMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(pickString(value));
}

function pickShopDisplayName(shop) {
  if (!shop) {
    return "";
  }
  return pickString(shop.shopName) || pickString(shop.description);
}

async function findShopByObjectId(id) {
  if (!isStrictMongoObjectId(id)) {
    return null;
  }
  return ShopProfile.findById(id).lean();
}

async function findOrCreateShopFromRestaurant(restaurant) {
  const externalId = pickString(restaurant?.externalId);
  if (!externalId) {
    return null;
  }

  let shop = await ShopProfile.findOne({ externalRestaurantId: externalId }).lean();
  if (shop) {
    return shop;
  }

  try {
    const created = await ShopProfile.create({
      externalRestaurantId: externalId,
      description: restaurant.name,
      shopName: restaurant.name,
      address: restaurant.address || "",
      DiaChiHeThong: restaurant.address || "",
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      phone: restaurant.phone || restaurant.zalo || "",
    });
    return created.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      return ShopProfile.findOne({ externalRestaurantId: externalId }).lean();
    }
    throw error;
  }
}

async function resolveShopByStoreId(storeId, storeName = "") {
  const rawId = pickString(storeId);
  if (!rawId) {
    throw createServiceError("Thiếu mã gian hàng.", 400);
  }

  const shopByObjectId = await findShopByObjectId(rawId);
  if (shopByObjectId) {
    return shopByObjectId;
  }

  let shop = await ShopProfile.findOne({ externalRestaurantId: rawId }).lean();
  if (shop) {
    return shop;
  }

  let restaurant = await Restaurant.findOne({ externalId: rawId }).lean();
  if (!restaurant && storeName) {
    restaurant = await Restaurant.findOne({ name: storeName }).lean();
  }
  if (!restaurant) {
    throw createServiceError("Không tìm thấy gian hàng để báo cáo.", 404);
  }

  shop = await findOrCreateShopFromRestaurant(restaurant);
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng để báo cáo.", 404);
  }

  return shop;
}

async function resolveProductById(productId) {
  const rawId = pickString(productId);
  if (!isStrictMongoObjectId(rawId)) {
    throw createServiceError("Mã sản phẩm không hợp lệ.", 400);
  }

  const product = await Product.findById(rawId).lean();
  if (!product) {
    throw createServiceError("Không tìm thấy sản phẩm để báo cáo.", 404);
  }

  return product;
}

function inferReportType(payload = {}) {
  const explicitType = Number(payload.reportType);
  if (Object.values(REPORT_TYPE).includes(explicitType)) {
    return explicitType;
  }

  if (pickString(payload.productId || payload.product_id)) {
    return REPORT_TYPE.PRODUCT;
  }

  if (pickString(payload.shopId || payload.shop_id || payload.storeId || payload.store_id)) {
    return REPORT_TYPE.SHOP;
  }

  return REPORT_TYPE.USER;
}

async function createReport(user, payload = {}) {
  const title = pickString(payload.title || payload.reason);
  if (!title) {
    throw createServiceError("Vui lòng chọn lý do báo cáo.", 400);
  }

  const reportType = inferReportType(payload);
  const note = pickString(payload.content || payload.message || payload.note);
  const now = new Date();

  const reportData = {
    userId: user._id,
    reportType,
    title,
    status: REPORT_STATUS.PENDING,
    CreatedAt: now,
    UpdatedAt: now,
  };

  if (reportType === REPORT_TYPE.PRODUCT) {
    const productId = pickString(payload.productId || payload.product_id);
    const product = await resolveProductById(productId);
    const productName = pickString(payload.productName || payload.product_name) || product.ProductName;
    let shop = null;

    if (product.ShopId) {
      shop = await findShopByObjectId(String(product.ShopId));
    }

    reportData.productId = product._id;
    reportData.shopId = shop?._id || product.ShopId || null;
    reportData.targetUserId = shop?.userId || null;
    reportData.content =
      note ||
      `Báo cáo sản phẩm "${productName}"${shop ? ` thuộc gian hàng "${pickShopDisplayName(shop)}"` : ""}: ${title}`;
  } else if (reportType === REPORT_TYPE.SHOP) {
    const storeId = pickString(
      payload.shopId || payload.shop_id || payload.storeId || payload.store_id
    );
    const storeName = pickString(
      payload.shopName || payload.shop_name || payload.storeName || payload.store_name
    );
    const shop = await resolveShopByStoreId(storeId, storeName);
    const shopName = storeName || pickShopDisplayName(shop);

    reportData.shopId = shop._id;
    reportData.targetUserId = shop.userId || null;
    reportData.content = note || `Báo cáo gian hàng "${shopName}": ${title}`;
  } else {
    reportData.content = note || title;
  }

  const report = await Report.create(reportData);

  return {
    id: String(report._id),
    reportType: report.reportType,
    title: report.title,
    content: report.content,
    status: report.status,
    createdAt: report.CreatedAt,
  };
}

module.exports = {
  createReport,
};

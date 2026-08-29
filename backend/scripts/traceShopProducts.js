require("../config/env");
const mongoose = require("mongoose");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const SellerSubscription = require("../models/SellerSubscription");
const User = require("../models/User");
const { mongoUri } = require("../config/env");
const { isSubscriptionActive, PRODUCT_STATUS, SHOP_STATUS } = require("../constants");
const { publicProductFilter } = require("../services/productService");
const { ensureSubscriptionFresh } = require("../services/sellerPlanAccessService");
const shopDiscoveryService = require("../services/shopDiscoveryService");
const { removedProductMatch } = require("../utils/productRemoval");

async function main() {
  const query = String(process.argv[2] || "huyenquanglonngon1").trim();
  await mongoose.connect(mongoUri);

  const shop = await ShopProfile.findOne({
    $or: [
      { shopUsername: new RegExp(`^${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      { shopName: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
    ],
  });

  if (!shop) {
    const byUser = await User.findOne({
      UserName: new RegExp(`^${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
    if (byUser) {
      const shopByUser = await ShopProfile.findOne({ userId: byUser._id });
      if (shopByUser) {
        await traceShop(shopByUser, byUser);
        await mongoose.disconnect();
        return;
      }
    }
    console.log(JSON.stringify({ error: "Shop not found", query }, null, 2));
    await mongoose.disconnect();
    process.exit(1);
  }

  const seller = await User.findById(shop.userId).lean();
  await traceShop(shop, seller);
  await mongoose.disconnect();
}

async function traceShop(shopDoc, seller) {
  const shopId = shopDoc._id;
  const before = shopDoc.toObject();

  const activeSub = await SellerSubscription.findOne({
    shopId,
    status: 1,
    endDate: { $gte: new Date() },
  })
    .sort({ endDate: -1 })
    .lean();

  const allProducts = await Product.find({ ShopId: shopId }).lean();
  const publicFilter = publicProductFilter({ ShopId: shopId });
  const publicProducts = await Product.find(publicFilter).lean();
  const removedOnly = await Product.find({
    ShopId: shopId,
    ...removedProductMatch(),
  }).lean();

  let apiList = null;
  let apiShop = null;
  let apiError = null;
  try {
    apiShop = await shopDiscoveryService.getPublicShopById(String(shopId));
    apiList = await shopDiscoveryService.listPublicProductsByShopId(String(shopId), {
      page: 1,
      limit: 50,
    });
  } catch (error) {
    apiError = { message: error.message, statusCode: error.statusCode || 500 };
  }

  const shopFresh = await ShopProfile.findById(shopId);
  await ensureSubscriptionFresh(shopFresh);

  const report = {
    shop: {
      id: String(shopId),
      shopName: shopDoc.shopName,
      shopUsername: shopDoc.shopUsername,
      status: shopDoc.status,
      isActive: before.isActive,
      isActiveAfterFresh: shopFresh.isActive,
      isSubscriptionActiveBefore: isSubscriptionActive(before),
      isSubscriptionActiveAfter: isSubscriptionActive(shopFresh),
      userId: String(shopDoc.userId || ""),
      sellerUserName: seller?.UserName || null,
      sellerRole: seller?.Role ?? null,
    },
    subscription: activeSub
      ? {
          id: String(activeSub._id),
          status: activeSub.status,
          endDate: activeSub.endDate,
          planId: String(activeSub.planId || activeSub.sellerPlanId || ""),
        }
      : null,
    productCounts: {
      totalInDb: allProducts.length,
      publicFilterMatch: publicProducts.length,
      markedRemoved: removedOnly.length,
      statusBreakdown: allProducts.reduce((acc, p) => {
        const key = String(p.Status);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      isDeletedBreakdown: allProducts.reduce((acc, p) => {
        const key = String(p.IsDeleted);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    },
    products: allProducts.map((p) => ({
      id: String(p._id),
      name: p.ProductName,
      status: p.Status,
      isDeleted: p.IsDeleted,
      removedBy: p.RemovedBy || "",
      inPublicFilter: publicProducts.some((x) => String(x._id) === String(p._id)),
      variantCount: 0,
    })),
    api: {
      getPublicShopById: apiShop ? { id: apiShop.id, product_count: apiShop.product_count } : null,
      listPublicProductsByShopId: apiList
        ? { total: apiList.total, count: apiList.items?.length || 0, names: (apiList.items || []).map((x) => x.name) }
        : null,
      error: apiError,
    },
    likelyCause: [],
  };

  for (const row of report.products) {
    row.variantCount = await ProductVariant.countDocuments({ ProductId: row.id });
  }

  if (Number(shopDoc.status) === SHOP_STATUS.BLOCKED) {
    report.likelyCause.push("Gian hàng bị khóa (status=BLOCKED) — API trả 0 sản phẩm.");
  }
  if (!isSubscriptionActive(before) && !activeSub) {
    report.likelyCause.push("Không có gói bán còn hiệu lực — API trả 404 / danh sách rỗng.");
  } else if (!isSubscriptionActive(before) && activeSub) {
    report.likelyCause.push("Có gói active nhưng shop.isActive cache cũ — đã sync qua ensureSubscriptionFresh.");
  }
  if (allProducts.length > 0 && publicProducts.length === 0) {
    report.likelyCause.push("Có sản phẩm trong DB nhưng không qua publicProductFilter (Status ẩn / IsDeleted / RemovedBy).");
  }
  if (publicProducts.length > 0 && apiError) {
    report.likelyCause.push(`API lỗi: ${apiError.message}`);
  }
  if (publicProducts.length > 0 && apiList && (apiList.items || []).length === 0) {
    report.likelyCause.push("publicProductFilter có kết quả nhưng listPublicProductsByShopId trả rỗng — kiểm tra map DTO.");
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

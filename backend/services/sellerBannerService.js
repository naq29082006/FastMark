const mongoose = require("mongoose");
const crypto = require("crypto");
const BannerPlan = require("../models/BannerPlan");
const SellerBannerPlan = require("../models/SellerBannerPlan");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const {
  SELLER_BANNER_STATUS,
  SELLER_BANNER_STATUS_LABEL,
  BANNER_TARGET_TYPE,
  BANNER_TARGET_TYPE_LABEL,
  PRODUCT_STATUS,
  RECORD_STATUS,
  isRecordActive,
  activeRecordFilter,
  activeSubscriptionFilter,
} = require("../constants");
const { debitWallet, getWalletBalance } = require("./walletService");
const { getShopForSeller } = require("./shopSettingsService");
const {
  assertCanBuyBanner,
  createServiceError,
} = require("./sellerPlanAccessService");
const { uploadImageToSupabase, resolveFileExtension } = require("./uploadService");
const { resolveShopDisplayName, resolveShopUsername } = require("../utils/shopIdentity");
const { emitAdminUpdated, emitUserResourceUpdated, emitPublicUpdated } = require("./realtimeService");
const { buildSearchRegex } = require("../utils/searchText");
const {
  findUsersBySearchRegex,
  buildObjectIdSearchConditions,
  appendStatusLabelSearchConditions,
  appendUniqueOrConditions,
} = require("../utils/adminSearchHelpers");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");
const { sliceSeededPage } = require("../utils/pagination");

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days) || 0);
  return next;
}

function pickString(value) {
  return String(value || "").trim();
}

function resolveDurationDays(payload = {}) {
  if (payload.durationDays !== undefined && payload.durationDays !== null && payload.durationDays !== "") {
    return Number(payload.durationDays);
  }
  if (payload.durationMonths !== undefined && payload.durationMonths !== null && payload.durationMonths !== "") {
    return Number(payload.durationMonths) * 30;
  }
  return NaN;
}

function isWithinDisplayWindow(doc, now = new Date()) {
  if (!doc.startDate || !doc.endDate) return false;
  if (new Date(doc.startDate) > now) return false;
  if (new Date(doc.endDate) < now) return false;
  return true;
}

function resolveLifecycle(doc, now = new Date()) {
  const status = Number(doc.status);
  // Legacy: mua xong auto ACTIVE nhưng chưa từng được admin duyệt.
  if (status === SELLER_BANNER_STATUS.ACTIVE && !doc.approvedAt) {
    return "purchased";
  }
  if (status === SELLER_BANNER_STATUS.PURCHASED) return "purchased";
  if (status === SELLER_BANNER_STATUS.PENDING_REVIEW) return "pending";
  if (status === SELLER_BANNER_STATUS.REJECTED) return "rejected";
  if (status === SELLER_BANNER_STATUS.CANCELLED) return "cancelled";
  if (status === SELLER_BANNER_STATUS.ACTIVE) {
    if (doc.endDate && new Date(doc.endDate) < now) return "expired";
    return "active";
  }
  return "unknown";
}

function lifecycleLabel(lifecycle) {
  if (lifecycle === "purchased") return "Chưa yêu cầu treo";
  if (lifecycle === "pending") return "Chờ duyệt treo";
  if (lifecycle === "active") return "Đang treo";
  if (lifecycle === "expired") return "Đã hết hạn";
  if (lifecycle === "cancelled") return "Đã hủy / gỡ";
  if (lifecycle === "rejected") return "Bị từ chối — có thể sửa gửi lại";
  return "Không rõ";
}

function toBannerPlanDto(doc) {
  const durationDays = Math.max(1, Number(doc.durationDays) || 30);
  const durationMonths = Math.max(1, Math.round(durationDays / 30));
  return {
    id: String(doc._id),
    name: doc.name || "",
    description: doc.description || "",
    durationDays,
    durationMonths,
    price: Math.max(0, Number(doc.price) || 0),
    isActive: isRecordActive(doc.isActive),
    createdAt: doc.CreatedAt || null,
    updatedAt: doc.UpdatedAt || null,
  };
}

function toSellerBannerDto(doc, extras = {}) {
  const now = extras.now || new Date();
  const lifecycle = resolveLifecycle(doc, now);
  const rawStatus = Number(doc.status);
  const isLegacyActive = rawStatus === SELLER_BANNER_STATUS.ACTIVE && !doc.approvedAt;
  const status = isLegacyActive ? SELLER_BANNER_STATUS.PURCHASED : rawStatus;
  const targetType = Number(doc.targetType) || BANNER_TARGET_TYPE.SHOP;
  const canEditCreative =
    lifecycle === "purchased" || lifecycle === "rejected";
  const startDate = lifecycle === "purchased" || lifecycle === "rejected" || lifecycle === "pending"
    ? null
    : doc.startDate || null;
  const endDate = lifecycle === "purchased" || lifecycle === "rejected" || lifecycle === "pending"
    ? null
    : doc.endDate || null;
  return {
    id: String(doc._id),
    sellerId: doc.sellerId ? String(doc.sellerId) : "",
    shopId: doc.shopId ? String(doc.shopId) : "",
    planId: doc.planId ? String(doc.planId) : "",
    planName: doc.planName || "",
    durationDays: Math.max(1, Number(doc.durationDays) || 7),
    amount: Number(doc.amount) || 0,
    ngayMua: doc.ngayMua || doc.CreatedAt || null,
    startDate,
    endDate,
    approvedAt: doc.approvedAt || null,
    status,
    statusLabel:
      SELLER_BANNER_STATUS_LABEL[status] ||
      (lifecycle === "purchased" ? "Chưa yêu cầu treo" : "Không rõ"),
    lifecycle,
    lifecycleLabel: lifecycleLabel(lifecycle),
    canEditCreative,
    lyDoVP: doc.lyDoVP || "",
    image: doc.image || "",
    targetType,
    targetTypeLabel: BANNER_TARGET_TYPE_LABEL[targetType] || "Gian hàng",
    targetId: doc.targetId || "",
    clickCount: Math.max(0, Number(doc.clickCount) || Number(doc.click) || 0),
    createdAt: doc.CreatedAt || null,
    seller: extras.seller || null,
    shop: extras.shop || null,
  };
}

function emitBannerRealtime(banner, extra = {}) {
  if (!banner?._id) {
    return;
  }

  const payload = {
    bannerId: String(banner._id),
    status: Number(banner.status),
    shopId: String(banner.shopId || ""),
    sellerId: String(banner.sellerId || ""),
    ...extra,
  };

  emitAdminUpdated("banner", payload);
  if (banner.sellerId) {
    emitUserResourceUpdated(banner.sellerId, "banner", payload);
  }
  if (Number(banner.status) === SELLER_BANNER_STATUS.ACTIVE) {
    emitPublicUpdated("banner", payload);
  }
}

async function listAdminBannerPlans() {
  const rows = await BannerPlan.find(activeRecordFilter())
    .sort({ price: 1, CreatedAt: 1 })
    .limit(100);
  return rows.map(toBannerPlanDto);
}

async function listActiveBannerPlans() {
  const rows = await BannerPlan.find(activeRecordFilter())
    .sort({ price: 1, CreatedAt: 1 })
    .limit(50);
  return rows.map(toBannerPlanDto);
}

async function createBannerPlan(payload = {}) {
  const name = pickString(payload.name);
  const durationDays = resolveDurationDays(payload);
  const price = Number(payload.price);
  const isActive =
    payload.isActive === undefined ? true : isRecordActive(payload.isActive);

  if (!name) {
    throw createServiceError("Thiếu tên gói banner.");
  }
  if (!Number.isFinite(durationDays) || durationDays < 1) {
    throw createServiceError("Thời hạn phải >= 1 ngày.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw createServiceError("Giá không hợp lệ.");
  }

  const existing = await BannerPlan.findOne({ name });
  if (existing) {
    if (!isRecordActive(existing.isActive)) {
      existing.description = pickString(payload.description);
      existing.durationDays = Math.round(durationDays);
      existing.price = price;
      existing.isActive = RECORD_STATUS.ACTIVE;
      existing.UpdatedAt = new Date();
      await existing.save();
      return { plan: toBannerPlanDto(existing), restored: true };
    }
    throw createServiceError("Tên gói banner đã tồn tại.");
  }

  const plan = await BannerPlan.create({
    name,
    description: pickString(payload.description),
    durationDays: Math.round(durationDays),
    price,
    isActive: isActive ? RECORD_STATUS.ACTIVE : RECORD_STATUS.HIDDEN,
  });
  return { plan: toBannerPlanDto(plan), restored: false };
}

async function updateBannerPlan(planId, payload = {}) {
  const plan = await BannerPlan.findById(planId);
  if (!plan) {
    throw createServiceError("Không tìm thấy gói banner.", 404);
  }
  if (payload.name !== undefined) {
    const name = pickString(payload.name);
    if (!name) throw createServiceError("Thiếu tên gói banner.");
    plan.name = name;
  }
  if (payload.description !== undefined) {
    plan.description = pickString(payload.description);
  }

  const hasDurationField =
    payload.durationDays !== undefined || payload.durationMonths !== undefined;
  if (hasDurationField) {
    const durationDays = resolveDurationDays(payload);
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      throw createServiceError("Thời hạn phải >= 1 ngày.");
    }
    plan.durationDays = Math.round(durationDays);
  }

  if (payload.price !== undefined) {
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0) {
      throw createServiceError("Giá không hợp lệ.");
    }
    plan.price = price;
  }

  if (payload.isActive !== undefined || payload.status !== undefined) {
    const nextActive =
      payload.isActive !== undefined
        ? isRecordActive(payload.isActive)
        : Number(payload.status) === RECORD_STATUS.ACTIVE;
    plan.isActive = nextActive ? RECORD_STATUS.ACTIVE : RECORD_STATUS.HIDDEN;
  }

  await plan.save();
  return toBannerPlanDto(plan);
}

async function deleteBannerPlan(planId) {
  const plan = await BannerPlan.findById(planId);
  if (!plan) {
    throw createServiceError("Không tìm thấy gói banner.", 404);
  }
  plan.isActive = RECORD_STATUS.HIDDEN;
  await plan.save();
  return toBannerPlanDto(plan);
}

async function restoreBannerPlan(planId) {
  const plan = await BannerPlan.findById(planId);
  if (!plan) {
    throw createServiceError("Không tìm thấy gói banner.", 404);
  }
  if (isRecordActive(plan.isActive)) {
    return toBannerPlanDto(plan);
  }
  plan.isActive = RECORD_STATUS.ACTIVE;
  await plan.save();
  return toBannerPlanDto(plan);
}

async function resolveImageUrl(imageInput) {
  if (imageInput && typeof imageInput === "object") {
    const existing = pickString(imageInput.imageUrl || imageInput.image || imageInput.ImageUrl);
    if (existing) return existing;
    const base64 = imageInput.imageBase64 || imageInput.base64;
    if (base64) {
      return resolveImageUrl(
        String(base64).startsWith("data:")
          ? base64
          : `data:${imageInput.mimeType || "image/jpeg"};base64,${base64}`
      );
    }
  }
  const raw = pickString(imageInput);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const match = raw.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return raw;
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const uploaded = await uploadImageToSupabase({
    buffer,
    mimeType,
    folder: "seller-banners",
    fileName: `banner-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${resolveFileExtension(mimeType)}`,
  });
  return uploaded.publicUrl;
}

async function getSellerBannerState(user) {
  const shop = await getShopForSeller(user);
  await assertCanBuyBanner(shop);
  const plans = await listActiveBannerPlans();

  // Chuẩn hóa legacy: mua xong auto ACTIVE (chưa có approvedAt) → về PURCHASED.
  await SellerBannerPlan.updateMany(
    {
      shopId: shop._id,
      status: SELLER_BANNER_STATUS.ACTIVE,
      $or: [{ approvedAt: null }, { approvedAt: { $exists: false } }],
    },
    {
      $set: {
        status: SELLER_BANNER_STATUS.PURCHASED,
        startDate: null,
        endDate: null,
        UpdatedAt: new Date(),
      },
    }
  );

  const rows = await SellerBannerPlan.find({ shopId: shop._id })
    .sort({ ngayMua: -1, CreatedAt: -1 })
    .limit(50)
    .lean();
  const banners = rows.map((row) => toSellerBannerDto(row));
  const wallet = await getWalletBalance(user._id);
  return {
    plans,
    banners,
    banner:
      banners.find((item) => item.lifecycle === "purchased") ||
      banners.find((item) => item.lifecycle === "rejected") ||
      banners.find((item) => item.lifecycle === "pending") ||
      banners.find((item) => item.lifecycle === "active") ||
      banners[0] ||
      null,
    walletBalance: Number(wallet.balance) || 0,
    canBuyBanner: true,
  };
}

async function purchaseBannerPlan(user, payload = {}) {
  const shop = await getShopForSeller(user);
  await assertCanBuyBanner(shop);

  const planId = pickString(payload.planId);
  if (!planId) {
    throw createServiceError("Thiếu planId.");
  }

  const plan = await BannerPlan.findOne({ _id: planId, ...activeRecordFilter() });
  if (!plan) {
    throw createServiceError("Gói banner không hợp lệ hoặc đang tạm ẩn.");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(user._id, plan.price, {
      description: `Gói banner: ${plan.name}`,
      session,
    });

    const now = new Date();
    const durationDays = Math.max(1, Number(plan.durationDays) || 7);
    const [created] = await SellerBannerPlan.create(
      [
        {
          sellerId: user._id,
          shopId: shop._id,
          planId: plan._id,
          planName: plan.name,
          durationDays,
          amount: plan.price,
          ngayMua: now,
          // Hiệu lực chỉ gắn khi admin duyệt — lúc mua chỉ lưu ngày mua.
          startDate: null,
          endDate: null,
          approvedAt: null,
          status: SELLER_BANNER_STATUS.PURCHASED,
          lyDoVP: "",
          image: "",
          targetType: BANNER_TARGET_TYPE.SHOP,
          targetId: "",
          clickCount: 0,
          CreatedAt: now,
          UpdatedAt: now,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    const wallet = await getWalletBalance(user._id);
    emitBannerRealtime(created);
    emitUserResourceUpdated(user._id, "wallet", { balance: Number(wallet.balance) || 0 });
    return {
      banner: toSellerBannerDto(created),
      walletBalance: Number(wallet.balance) || 0,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function assertBannerTarget(shop, targetType, targetId) {
  const type = Number(targetType);
  const id = pickString(targetId);

  if (type === BANNER_TARGET_TYPE.SHOP) {
    const shopId = id || String(shop._id);
    if (shopId !== String(shop._id)) {
      throw createServiceError("Chỉ được treo banner về gian hàng của bạn.");
    }
    return { targetType: BANNER_TARGET_TYPE.SHOP, targetId: String(shop._id) };
  }

  if (type === BANNER_TARGET_TYPE.PRODUCT) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw createServiceError("Vui lòng chọn sản phẩm đích.");
    }
    const product = await Product.findOne({
      _id: id,
      ShopId: shop._id,
      Status: PRODUCT_STATUS.ACTIVE,
    })
      .select("_id ProductName")
      .lean();
    if (!product) {
      throw createServiceError("Sản phẩm không thuộc gian hàng hoặc đang bị ẩn.");
    }
    return { targetType: BANNER_TARGET_TYPE.PRODUCT, targetId: String(product._id) };
  }

  throw createServiceError("Đích đến chỉ hỗ trợ Gian hàng hoặc Sản phẩm.");
}

/**
 * Seller gửi yêu cầu treo: lưu creative + khóa chỉnh sửa + chờ admin duyệt.
 */
async function requestBannerHang(user, payload = {}) {
  const shop = await getShopForSeller(user);
  await assertCanBuyBanner(shop);

  const bannerId = pickString(payload.bannerId || payload.id);
  if (!bannerId) {
    throw createServiceError("Thiếu bannerId.");
  }

  const banner = await SellerBannerPlan.findOne({
    _id: bannerId,
    shopId: shop._id,
  });
  if (!banner) {
    throw createServiceError("Không tìm thấy gói banner.", 404);
  }
  if (
    Number(banner.status) !== SELLER_BANNER_STATUS.PURCHASED &&
    Number(banner.status) !== SELLER_BANNER_STATUS.REJECTED &&
    !(Number(banner.status) === SELLER_BANNER_STATUS.ACTIVE && !banner.approvedAt)
  ) {
    throw createServiceError("Gói này đang chờ duyệt hoặc đã treo, không chỉnh sửa được.");
  }

  // Legacy auto-active → đưa về PURCHASED trước khi gửi yêu cầu.
  if (Number(banner.status) === SELLER_BANNER_STATUS.ACTIVE && !banner.approvedAt) {
    banner.status = SELLER_BANNER_STATUS.PURCHASED;
    banner.startDate = null;
    banner.endDate = null;
  }

  const image = await resolveImageUrl(
    payload.image || payload.imageUrl || payload
  );
  if (!image) {
    throw createServiceError("Vui lòng chọn ảnh banner.");
  }

  const target = await assertBannerTarget(
    shop,
    payload.targetType ?? banner.targetType,
    payload.targetId ?? banner.targetId
  );

  banner.image = image;
  banner.targetType = target.targetType;
  banner.targetId = target.targetId;
  banner.status = SELLER_BANNER_STATUS.PENDING_REVIEW;
  banner.lyDoVP = "";
  banner.startDate = null;
  banner.endDate = null;
  banner.approvedAt = null;
  await banner.save();

  emitBannerRealtime(banner);
  return toSellerBannerDto(banner);
}

/** @deprecated alias — giữ tương thích API cũ, luôn coi như gửi yêu cầu treo. */
async function updateBannerCreative(user, payload = {}) {
  return requestBannerHang(user, payload);
}

/**
 * Admin list.
 * filter/lifecycle: active | expired | cancelled | rejected
 * hoặc status số: 1|2|3
 */
async function listAdminSellerBanners({
  page = 1,
  limit = 20,
  status = "",
  filter = "",
  search = "",
  from = "",
  to = "",
} = {}) {
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
  const pageNumber = Math.max(1, Number(page) || 1);
  const skip = (pageNumber - 1) * pageSize;
  const now = new Date();
  const query = {};

  const lifecycle = pickString(filter || status).toLowerCase();
  if (
    lifecycle === "inactive" ||
    lifecycle === "chua-hoat-dong" ||
    lifecycle === "not_active"
  ) {
    // Chưa hoạt động: mua rồi / chờ duyệt / bị từ chối / legacy auto-active chưa duyệt.
    query.$or = [
      {
        status: {
          $in: [
            SELLER_BANNER_STATUS.PURCHASED,
            SELLER_BANNER_STATUS.PENDING_REVIEW,
            SELLER_BANNER_STATUS.REJECTED,
          ],
        },
      },
      {
        status: SELLER_BANNER_STATUS.ACTIVE,
        $or: [{ approvedAt: null }, { approvedAt: { $exists: false } }],
      },
    ];
  } else if (lifecycle === "purchased" || lifecycle === "0") {
    query.status = SELLER_BANNER_STATUS.PURCHASED;
  } else if (lifecycle === "pending" || lifecycle === "4") {
    query.status = SELLER_BANNER_STATUS.PENDING_REVIEW;
  } else if (lifecycle === "manage" || lifecycle === "queue") {
    query.$or = [
      { status: SELLER_BANNER_STATUS.PENDING_REVIEW },
      {
        status: SELLER_BANNER_STATUS.ACTIVE,
        approvedAt: { $ne: null },
        endDate: { $gte: now },
      },
    ];
  } else if (lifecycle === "active" || lifecycle === "dang-hoat-dong") {
    query.status = SELLER_BANNER_STATUS.ACTIVE;
    query.approvedAt = { $ne: null };
    query.endDate = { $gte: now };
  } else if (lifecycle === "expired") {
    query.status = SELLER_BANNER_STATUS.ACTIVE;
    query.approvedAt = { $ne: null };
    query.endDate = { $lt: now };
  } else if (lifecycle === "cancelled" || lifecycle === "2") {
    query.status = SELLER_BANNER_STATUS.CANCELLED;
  } else if (lifecycle === "rejected" || lifecycle === "3") {
    query.status = SELLER_BANNER_STATUS.REJECTED;
  } else if (lifecycle === "1") {
    query.status = SELLER_BANNER_STATUS.ACTIVE;
    query.approvedAt = { $ne: null };
    query.endDate = { $gte: now };
  } else if (status !== "" && status !== undefined && status !== null) {
    const statusNum = Number(status);
    if (Number.isFinite(statusNum)) {
      query.status = statusNum;
    }
  }

  if (search) {
    const orConditions = [];
    const regex = buildSearchRegex(search);

    if (regex) {
      const [matchedUsers, matchedShops] = await Promise.all([
        findUsersBySearchRegex(User, regex, ["FullName", "UserName", "Email"]),
        ShopProfile.find({
          $or: [{ shopName: regex }, { shopUsername: regex }, { description: regex }],
        })
          .select("_id")
          .lean(),
      ]);

      orConditions.push(
        { planName: regex },
        { lyDoVP: regex },
        ...(matchedUsers.length ? [{ sellerId: { $in: matchedUsers.map((user) => user._id) } }] : []),
        ...(matchedShops.length ? [{ shopId: { $in: matchedShops.map((shop) => shop._id) } }] : [])
      );
    }

    appendStatusLabelSearchConditions(orConditions, search, SELLER_BANNER_STATUS_LABEL);
    orConditions.push(...buildObjectIdSearchConditions(search));

    if (orConditions.length) {
      appendUniqueOrConditions(query, orConditions);
    }
  }

  applyCreatedAtRange(query, { from, to });

  const paidBannerStatuses = [
    SELLER_BANNER_STATUS.PURCHASED,
    SELLER_BANNER_STATUS.PENDING_REVIEW,
    SELLER_BANNER_STATUS.ACTIVE,
    SELLER_BANNER_STATUS.CANCELLED,
    SELLER_BANNER_STATUS.REJECTED,
  ];

  const [rows, total, summaryTotal, summaryActive, summaryPending, summaryExpired, summaryPurchased, summaryRevenue, summaryShops] =
    await Promise.all([
    SellerBannerPlan.find(query)
      .sort({ ngayMua: -1, CreatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    SellerBannerPlan.countDocuments(query),
    SellerBannerPlan.countDocuments({ status: { $in: paidBannerStatuses } }),
    SellerBannerPlan.countDocuments({
      status: SELLER_BANNER_STATUS.ACTIVE,
      approvedAt: { $ne: null },
      endDate: { $gte: now },
    }),
    SellerBannerPlan.countDocuments({
      status: SELLER_BANNER_STATUS.PENDING_REVIEW,
    }),
    SellerBannerPlan.countDocuments({
      status: SELLER_BANNER_STATUS.ACTIVE,
      approvedAt: { $ne: null },
      endDate: { $lt: now },
    }),
    SellerBannerPlan.countDocuments({
      status: SELLER_BANNER_STATUS.PURCHASED,
    }),
    SellerBannerPlan.aggregate([
      { $match: { status: { $in: paidBannerStatuses } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]),
    SellerBannerPlan.distinct("shopId", { status: { $in: paidBannerStatuses } }),
  ]);

  const sellerIds = rows.map((r) => r.sellerId).filter(Boolean);
  const shopIds = rows.map((r) => r.shopId).filter(Boolean);
  const [sellers, shops] = await Promise.all([
    sellerIds.length
      ? User.find({ _id: { $in: sellerIds } }).select("FullName UserName Email").lean()
      : [],
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } })
          .select("shopName shopUsername avatar description addressHeThong address userId")
          .lean()
      : [],
  ]);
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));
  const shopById = new Map(shops.map((s) => [String(s._id), s]));

  return {
    items: rows.map((row) => {
      const seller = sellerById.get(String(row.sellerId));
      const shop = shopById.get(String(row.shopId));
      return toSellerBannerDto(row, {
        now,
        seller: seller
          ? {
              id: String(seller._id),
              fullName: seller.FullName || "",
              userName: seller.UserName || "",
              email: seller.Email || "",
            }
          : null,
        shop: shop
          ? {
              id: String(shop._id),
              shopName: resolveShopDisplayName(shop, seller),
              shopUsername: resolveShopUsername(shop, seller),
              description: shop.description || "",
              address: shop.addressHeThong || shop.address || "",
              addressHeThong: shop.addressHeThong || shop.address || "",
            }
          : null,
      });
    }),
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    summary: {
      total: summaryTotal,
      active: summaryActive,
      pending: summaryPending,
      expired: summaryExpired,
      purchased: summaryPurchased,
      totalRevenue: Number(summaryRevenue[0]?.total) || 0,
      uniqueShops: summaryShops.length,
    },
  };
}

/** Home: lấy banner theo thứ tự ổn định trong cùng một seed phiên. */
async function listActiveSellerBannersForHome({ limit = 10, seed = "" } = {}) {
  const now = new Date();
  const max = Math.min(20, Number(limit) || 10);
  const rows = await SellerBannerPlan.find({
    status: SELLER_BANNER_STATUS.ACTIVE,
    approvedAt: { $ne: null },
    endDate: { $gte: now },
    image: { $nin: [null, ""] },
  })
    .sort({ CreatedAt: -1, _id: -1 })
    .limit(80)
    .lean();

  const shopIds = rows.map((r) => r.shopId).filter(Boolean);
  const shops = shopIds.length
    ? await ShopProfile.find({
        _id: { $in: shopIds },
        ...activeSubscriptionFilter(),
        status: { $ne: 0 },
      })
        .select("_id")
        .lean()
    : [];
  const activeShopIds = new Set(shops.map((s) => String(s._id)));

  const eligible = rows.filter(
    (row) => activeShopIds.has(String(row.shopId)) && isWithinDisplayWindow(row, now)
  );
  const selected = sliceSeededPage(eligible, {
    page: 1,
    limit: max,
    seed,
    namespace: "home-banners",
  }).items;

  return selected.map((row) => ({
    id: String(row._id),
    image: row.image || "",
    shopId: row.shopId ? String(row.shopId) : "",
    targetType: Number(row.targetType) || BANNER_TARGET_TYPE.SHOP,
    targetId: row.targetId || String(row.shopId),
    status: SELLER_BANNER_STATUS.ACTIVE,
    startDate: row.startDate || null,
    endDate: row.endDate || null,
    clickCount: Math.max(0, Number(row.clickCount) || Number(row.click) || 0),
    createdAt: row.CreatedAt,
    source: "seller",
  }));
}

async function listActiveBanners({ limit = 10, seed = "" } = {}) {
  return listActiveSellerBannersForHome({ limit, seed });
}

async function recordBannerClick(bannerId) {
  const id = pickString(bannerId).replace(/^seller-/, "");
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createServiceError("bannerId không hợp lệ.");
  }
  const updated = await SellerBannerPlan.findOneAndUpdate(
    {
      _id: id,
      status: SELLER_BANNER_STATUS.ACTIVE,
    },
    { $inc: { clickCount: 1 }, $set: { UpdatedAt: new Date() } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) {
    throw createServiceError("Không tìm thấy banner đang hoạt động.", 404);
  }
  return {
    id: String(updated._id),
    clickCount: Math.max(0, Number(updated.clickCount) || 0),
  };
}

async function approveSellerBanner(bannerId) {
  const banner = await SellerBannerPlan.findById(bannerId);
  if (!banner) {
    throw createServiceError("Không tìm thấy seller banner.", 404);
  }
  if (Number(banner.status) !== SELLER_BANNER_STATUS.PENDING_REVIEW) {
    throw createServiceError("Chỉ duyệt được banner đang chờ treo.");
  }
  if (!pickString(banner.image)) {
    throw createServiceError("Banner thiếu ảnh, không thể duyệt.");
  }

  const now = new Date();
  const durationDays = Math.max(1, Number(banner.durationDays) || 7);
  banner.startDate = now;
  banner.endDate = addDays(now, durationDays);
  banner.approvedAt = now;
  banner.status = SELLER_BANNER_STATUS.ACTIVE;
  banner.lyDoVP = "";
  await banner.save();
  emitBannerRealtime(banner);
  return toSellerBannerDto(banner);
}

async function rejectSellerBanner(bannerId, { reason } = {}) {
  const banner = await SellerBannerPlan.findById(bannerId);
  if (!banner) {
    throw createServiceError("Không tìm thấy seller banner.", 404);
  }
  if (Number(banner.status) !== SELLER_BANNER_STATUS.PENDING_REVIEW) {
    throw createServiceError("Chỉ từ chối được banner đang chờ duyệt treo.");
  }
  const lyDoVP = pickString(reason);
  if (!lyDoVP) {
    throw createServiceError("Vui lòng nhập lý do từ chối.");
  }

  // Không hoàn tiền — seller sửa creative rồi gửi yêu cầu treo lại.
  banner.status = SELLER_BANNER_STATUS.REJECTED;
  banner.lyDoVP = lyDoVP;
  banner.startDate = null;
  banner.endDate = null;
  banner.approvedAt = null;
  await banner.save();
  emitBannerRealtime(banner);
  return toSellerBannerDto(banner);
}

async function cancelSellerBanner(bannerId) {
  const banner = await SellerBannerPlan.findById(bannerId);
  if (!banner) {
    throw createServiceError("Không tìm thấy seller banner.", 404);
  }
  const status = Number(banner.status);
  if (
    status !== SELLER_BANNER_STATUS.ACTIVE &&
    status !== SELLER_BANNER_STATUS.PURCHASED &&
    status !== SELLER_BANNER_STATUS.PENDING_REVIEW
  ) {
    throw createServiceError("Banner này không thể hủy.");
  }
  banner.status = SELLER_BANNER_STATUS.CANCELLED;
  await banner.save();
  emitBannerRealtime(banner);
  return toSellerBannerDto(banner);
}

module.exports = {
  listAdminBannerPlans,
  listActiveBannerPlans,
  createBannerPlan,
  updateBannerPlan,
  deleteBannerPlan,
  restoreBannerPlan,
  getSellerBannerState,
  purchaseBannerPlan,
  updateBannerCreative,
  requestBannerHang,
  listAdminSellerBanners,
  listActiveSellerBannersForHome,
  listActiveBanners,
  recordBannerClick,
  approveSellerBanner,
  rejectSellerBanner,
  cancelSellerBanner,
  toBannerPlanDto,
  toSellerBannerDto,
};

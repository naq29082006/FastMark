const mongoose = require("mongoose");
const SellerSubscription = require("../models/SellerSubscription");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const WalletTransaction = require("../models/WalletTransaction");
const { SELLER_SUBSCRIPTION_STATUS, SELLER_SUBSCRIPTION_STATUS_LABEL, WALLET_TX_TYPE, isRecordActive } = require("../constants");
const { listActivePlans, getActivePlanById } = require("./sellerPlanService");
const { debitWallet, getWalletBalance } = require("./walletService");
const { getShopForSeller } = require("./shopSettingsService");
const {
  findActiveSubscription,
  syncShopFromSubscription,
  ensureSubscriptionFresh,
  unhideShopProducts,
  createServiceError,
} = require("./sellerPlanAccessService");
const { resolveShopDisplayName, resolveShopUsername } = require("../utils/shopIdentity");
const { emitAdminUpdated, emitUserResourceUpdated } = require("./realtimeService");
const { buildSearchRegex } = require("../utils/searchText");
const {
  findUsersBySearchRegex,
  buildObjectIdSearchConditions,
  appendStatusLabelSearchConditions,
  appendUniqueOrConditions,
} = require("../utils/adminSearchHelpers");
const { applyCreatedAtRange } = require("../utils/dateRangeFilter");

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days) || 0);
  return next;
}

function toSubscriptionRow(doc, extras = {}) {
  const ngayMua = doc.ngayMua || doc.CreatedAt || null;
  const startDate = doc.startDate || null;
  const endDate = doc.endDate || null;
  const orderCode = extras.orderCode != null ? extras.orderCode : null;
  const transactionId =
    extras.transactionId ||
    (doc.gdViId ? String(doc.gdViId) : "");
  return {
    id: String(doc._id),
    sellerId: doc.sellerId ? String(doc.sellerId) : "",
    shopId: doc.shopId ? String(doc.shopId) : "",
    planId: doc.planId ? String(doc.planId) : "",
    planName: doc.planName || "",
    amount: Number(doc.amount) || 0,
    // Ngày mua / có hiệu lực / hết hạn (chèn gói: hiệu lực = sau hạn dài nhất hiện có).
    ngayMua,
    createdAt: ngayMua,
    purchasedAt: ngayMua,
    startDate,
    effectiveFrom: startDate,
    endDate,
    expiresAt: endDate,
    status: Number(doc.status),
    statusLabel:
      SELLER_SUBSCRIPTION_STATUS_LABEL[Number(doc.status)] || "Không rõ",
    orderCode: orderCode != null ? Number(orderCode) : null,
    transactionId: transactionId || "",
    paymentId: transactionId || "",
    seller: extras.seller || null,
    shop: extras.shop || null,
  };
}

async function listShopPurchases(shopId) {
  if (!shopId) {
    return [];
  }
  const now = new Date();
  // Lấy mọi lần mua còn trong hạn (kể cả bản ghi từng bị đánh EXPIRED khi gia hạn cũ).
  const rows = await SellerSubscription.find({
    shopId,
    endDate: { $gte: now },
    status: { $ne: SELLER_SUBSCRIPTION_STATUS.CANCELLED },
  })
    .sort({ CreatedAt: 1, startDate: 1 })
    .limit(50)
    .lean();
  return rows.map((row) => toSubscriptionRow(row));
}

async function toSubscriptionDto(shop, walletBalance = null) {
  const active = await ensureSubscriptionFresh(shop);
  const purchases = await listShopPurchases(shop._id);

  let expiresAt = active?.endDate || null;
  if (purchases.length) {
    const maxEnd = purchases.reduce((max, row) => {
      const end = row.endDate ? new Date(row.endDate).getTime() : 0;
      return end > max ? end : max;
    }, 0);
    if (maxEnd > 0) {
      expiresAt = new Date(maxEnd);
    }
  }

  let daysLeft = 0;
  if (expiresAt) {
    daysLeft = Math.max(
      0,
      Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
  }

  const oldestPurchase = [...purchases].sort((a, b) => {
    const left = new Date(a.ngayMua || a.createdAt || a.startDate || 0).getTime();
    const right = new Date(b.ngayMua || b.createdAt || b.startDate || 0).getTime();
    return left - right;
  })[0];

  const plans = await listActivePlans();
  const hasActive = Boolean(active) || purchases.length > 0;

  return {
    plans,
    subscription: active ? toSubscriptionRow(active) : null,
    purchases,
    purchaseCount: purchases.length,
    subscriptionPlan: active?.planName || null,
    goiDangki: active?.planName || null,
    subscriptionExpiresAt: expiresAt,
    ngayHetHan: expiresAt,
    ngayMua:
      oldestPurchase?.ngayMua ||
      oldestPurchase?.createdAt ||
      oldestPurchase?.startDate ||
      active?.ngayMua ||
      active?.CreatedAt ||
      active?.startDate ||
      null,
    subscriptionActive: hasActive,
    isActive: isRecordActive(shop.isActive) && hasActive,
    daysLeft,
    canBuyBanner: hasActive,
    walletBalance: walletBalance == null ? null : Number(walletBalance) || 0,
  };
}

async function getSubscription(user) {
  const shop = await getShopForSeller(user);
  const wallet = await getWalletBalance(user._id);
  return toSubscriptionDto(shop, wallet.balance);
}

async function purchaseSubscription(user, payload = {}) {
  const planId = String(payload.planId || payload.id || "").trim();
  if (!planId) {
    throw createServiceError("Thiếu planId.");
  }

  const planDoc = await getActivePlanById(planId);
  if (!planDoc) {
    throw createServiceError("Gói không hợp lệ hoặc đang tạm ẩn.");
  }

  const shop = await getShopForSeller(user);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const debit = await debitWallet(user._id, planDoc.price, {
      description: `Gói bán hàng: ${planDoc.name}`,
      session,
    });
    const walletTx = debit?.transaction || null;

    const now = new Date();
    // Chèn gói: hiệu lực mới = sau ngày hết hạn lâu nhất đang còn (nối tiếp).
    const latest = await SellerSubscription.findOne({
      shopId: shop._id,
      endDate: { $gte: now },
      status: { $ne: SELLER_SUBSCRIPTION_STATUS.CANCELLED },
    })
      .sort({ endDate: -1 })
      .session(session);
    const base =
      latest && latest.endDate && new Date(latest.endDate) > now
        ? new Date(latest.endDate)
        : now;
    const endDate = addDays(base, planDoc.durationDays);

    // Giữ gói cũ ACTIVE để lịch sử / chi tiết; hạn mới = cộng dồn từ hạn hiện tại.
    const [created] = await SellerSubscription.create(
      [
        {
          sellerId: user._id,
          shopId: shop._id,
          planId: planDoc._id,
          planName: planDoc.name,
          amount: planDoc.price,
          ngayMua: now,
          startDate: base,
          endDate,
          status: SELLER_SUBSCRIPTION_STATUS.ACTIVE,
          gdViId: walletTx?._id || null,
          CreatedAt: now,
          UpdatedAt: now,
        },
      ],
      { session }
    );

    if (walletTx?._id) {
      walletTx.referenceId = created._id;
      walletTx.referenceType = "SellerSubscription";
      await walletTx.save({ session });
    }

    await syncShopFromSubscription(shop, created, session);
    await unhideShopProducts(shop._id, session);

    await session.commitTransaction();

    const wallet = await getWalletBalance(user._id);
    emitAdminUpdated("subscription", {
      subscriptionId: String(created._id),
      shopId: String(shop._id),
      userId: String(user._id),
    });
    emitUserResourceUpdated(user._id, "subscription", {
      subscriptionId: String(created._id),
      shopId: String(shop._id),
    });
    emitUserResourceUpdated(user._id, "wallet", { balance: wallet.balance });
    return toSubscriptionDto(shop, wallet.balance);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function listAdminSubscriptions({
  page = 1,
  limit = 20,
  status = "",
  search = "",
  from = "",
  to = "",
} = {}) {
  const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
  const pageNumber = Math.max(1, Number(page) || 1);
  const skip = (pageNumber - 1) * pageSize;
  const filter = {};

  if (status !== "" && status !== undefined && status !== null) {
    const statusNum = Number(status);
    if (Number.isFinite(statusNum)) {
      filter.status = statusNum;
    }
  }

  if (search) {
    const orConditions = [];
    const regex = buildSearchRegex(search);

    if (regex) {
      const [matchedUsers, matchedShops] = await Promise.all([
        findUsersBySearchRegex(User, regex, ["FullName", "UserName", "Email"]),
        ShopProfile.find({
          $or: [{ description: regex }, { addressHeThong: regex }, { shopName: regex }, { shopUsername: regex }],
        })
          .select("_id")
          .lean(),
      ]);

      orConditions.push(
        { planName: regex },
        ...(matchedUsers.length ? [{ sellerId: { $in: matchedUsers.map((user) => user._id) } }] : []),
        ...(matchedShops.length ? [{ shopId: { $in: matchedShops.map((shop) => shop._id) } }] : [])
      );
    }

    appendStatusLabelSearchConditions(orConditions, search, SELLER_SUBSCRIPTION_STATUS_LABEL);
    orConditions.push(...buildObjectIdSearchConditions(search));

    if (orConditions.length) {
      appendUniqueOrConditions(filter, orConditions);
    }
  }

  applyCreatedAtRange(filter, { from, to });

  const paidStatuses = [
    SELLER_SUBSCRIPTION_STATUS.ACTIVE,
    SELLER_SUBSCRIPTION_STATUS.EXPIRED,
  ];
  const now = new Date();

  const [rows, total, summaryTotal, summaryActive, summaryRevenue, summaryShops] =
    await Promise.all([
    SellerSubscription.find(filter)
      .sort({ ngayMua: -1, CreatedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    SellerSubscription.countDocuments(filter),
    SellerSubscription.countDocuments({ status: { $in: paidStatuses } }),
    SellerSubscription.countDocuments({
      status: SELLER_SUBSCRIPTION_STATUS.ACTIVE,
      endDate: { $gte: now },
    }),
    SellerSubscription.aggregate([
      { $match: { status: { $in: paidStatuses } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]),
    SellerSubscription.distinct("shopId", { status: { $in: paidStatuses } }),
  ]);

  const sellerIds = rows.map((r) => r.sellerId).filter(Boolean);
  const shopIds = rows.map((r) => r.shopId).filter(Boolean);
  const walletTxIds = [
    ...new Set(rows.map((r) => r.gdViId).filter(Boolean).map(String)),
  ];
  const [sellers, shops, walletTxs, linkedWalletTxs] = await Promise.all([
    sellerIds.length
      ? User.find({ _id: { $in: sellerIds } })
          .select("FullName UserName Email Phone")
          .lean()
      : [],
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } })
          .select("description addressHeThong address userId shopName shopUsername avatar")
          .lean()
      : [],
    sellerIds.length
      ? WalletTransaction.find({
          userId: { $in: sellerIds },
          type: WALLET_TX_TYPE.PAYMENT,
          description: { $regex: /^Gói bán hàng:/i },
        })
          .select("_id userId amount orderCode description CreatedAt referenceId")
          .sort({ CreatedAt: -1 })
          .limit(500)
          .lean()
      : [],
    walletTxIds.length
      ? WalletTransaction.find({ _id: { $in: walletTxIds } })
          .select("_id userId amount orderCode description CreatedAt referenceId")
          .lean()
      : [],
  ]);
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));
  const shopById = new Map(shops.map((s) => [String(s._id), s]));

  const txBySubscriptionId = new Map();
  const txById = new Map();
  const txCandidatesBySeller = new Map();
  for (const tx of [...walletTxs, ...linkedWalletTxs]) {
    txById.set(String(tx._id), tx);
    if (tx.referenceId) {
      txBySubscriptionId.set(String(tx.referenceId), tx);
    }
    const key = String(tx.userId);
    if (!txCandidatesBySeller.has(key)) txCandidatesBySeller.set(key, []);
    txCandidatesBySeller.get(key).push(tx);
  }

  function resolvePaymentTx(row) {
    if (row.gdViId) {
      const linked =
        txById.get(String(row.gdViId)) ||
        txBySubscriptionId.get(String(row._id));
      return {
        transactionId: String(row.gdViId),
        orderCode: linked?.orderCode != null ? Number(linked.orderCode) : null,
      };
    }
    const byRef = txBySubscriptionId.get(String(row._id));
    if (byRef) {
      return {
        transactionId: String(byRef._id),
        orderCode: byRef.orderCode != null ? Number(byRef.orderCode) : null,
      };
    }
    const purchasedAt = new Date(row.ngayMua || row.CreatedAt || 0).getTime();
    const amount = Number(row.amount) || 0;
    const planHint = String(row.planName || "").trim().toLowerCase();
    const candidates = txCandidatesBySeller.get(String(row.sellerId)) || [];
    const matched = candidates.find((tx) => {
      if (Number(tx.amount) !== amount) return false;
      const txTime = new Date(tx.CreatedAt || 0).getTime();
      if (!purchasedAt || Math.abs(txTime - purchasedAt) > 5 * 60 * 1000) return false;
      if (!planHint) return true;
      return String(tx.description || "").toLowerCase().includes(planHint);
    });
    if (!matched) return { transactionId: "", orderCode: null };
    return {
      transactionId: String(matched._id),
      orderCode: matched.orderCode != null ? Number(matched.orderCode) : null,
    };
  }

  return {
    items: rows.map((row) => {
      const seller = sellerById.get(String(row.sellerId));
      const shop = shopById.get(String(row.shopId));
      const shopName = resolveShopDisplayName(shop, seller);
      const shopUsername = resolveShopUsername(shop, seller);
      const payment = resolvePaymentTx(row);
      return toSubscriptionRow(row, {
        ...payment,
        seller: seller
          ? {
              id: String(seller._id),
              fullName: seller.FullName || "",
              userName: seller.UserName || "",
              email: seller.Email || "",
              phone: seller.Phone || "",
            }
          : null,
        shop: shop
          ? {
              id: String(shop._id),
              shopName,
              shopUsername,
              description: shop.description || "",
              address: shop.addressHeThong || shop.address || "",
              addressHeThong: shop.addressHeThong || shop.address || "",
              phone: seller?.Phone || "",
            }
          : {
              id: row.shopId ? String(row.shopId) : "",
              shopName,
              shopUsername,
              description: "",
              address: "",
              addressHeThong: "",
              phone: seller?.Phone || "",
            },
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
      totalRevenue: Number(summaryRevenue[0]?.total) || 0,
      uniqueShops: summaryShops.length,
    },
  };
}

module.exports = {
  getSubscription,
  purchaseSubscription,
  toSubscriptionDto,
  listAdminSubscriptions,
  listShopPurchases,
  toSubscriptionRow,
};

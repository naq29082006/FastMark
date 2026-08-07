const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const User = require("../models/User");
const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const {
  RESERVATION_STATUS,
  RESERVATION_STATUS_LABEL,
  RESERVATION_DISPUTE_REASON_LABEL,
  RESERVATION_AUDIT_ACTION,
  RESERVATION_DISPUTE_STATUS,
  DISPUTE_STATUS,
} = require("../constants");
const { getReservationReasonLabels } = require("../constants/reservationOrderFlow");
const {
  toPublicReservation,
  refundDepositIfHeld,
  releaseDepositIfHeld,
  processReservationLifecycle,
  releaseVariantInventory,
} = require("./reservationService");
const { emitOrderUpdated } = require("./orderRealtimeService");
const reservationDisputeService = require("./reservationDisputeService");
const Report = require("../models/Report");
const Review = require("../models/Review");
const ReservationDispute = require("../models/ReservationDispute");
const {
  disputeViewFromRecord,
  loadDisputesByReservationIds,
  appendDisputeAuditLog,
} = require("../utils/reservationDisputeView");
const { notDeletedReviewFilter } = require("../utils/reviewVisibility");
const {
  buildSearchRegex,
  buildStatusLabelEntries,
  resolveStatusesFromLabelSearch,
  appendUniqueOrConditions,
} = require("../utils/searchText");
const {
  findUsersBySearchRegex,
  findUsersByTokenSearch,
  buildObjectIdSearchConditions,
} = require("../utils/adminSearchHelpers");
const {
  resolveShopDisplayName,
  resolveShopAvatar,
  resolveShopUsername,
} = require("../utils/shopIdentity");
const { getReservationBuyerId, buyerIdFilter } = require("../utils/reservationCompat");
const {
  notifyAdminDisputeResolution,
  notifyReservationBoth,
} = require("./orderNotificationHelper");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickString(value) {
  return String(value || "").trim();
}

function toObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(value));
}

function parsePagination({ page, limit }, defaultLimit = 20) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || defaultLimit));
  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };
}

function parseDate(value, endOfDay = false) {
  const raw = pickString(value);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function resolveTabStatusFilter(tab) {
  const normalized = pickString(tab).toLowerCase();
  switch (normalized) {
    case "pending":
    case "pending_confirmation":
    case "waiting_confirmation":
      return [RESERVATION_STATUS.PENDING];
    case "disputes":
    case "dispute":
      return [RESERVATION_STATUS.DISPUTED];
    case "waiting":
    case "waiting_pickup":
      return [RESERVATION_STATUS.WAITING_PICKUP];
    case "completed":
      return [
        RESERVATION_STATUS.RECEIVED,
        RESERVATION_STATUS.COMPLETED,
        RESERVATION_STATUS.AUTO_COMPLETED,
      ];
    case "auto":
    case "auto_completed":
      return [RESERVATION_STATUS.AUTO_COMPLETED];
    case "cancelled":
    case "canceled":
    case "cancelled_orders":
      return [RESERVATION_STATUS.CANCELLED];
    case "seller_cancelled":
    case "seller_cancel_after_accept":
      // Filter đặc biệt trong buildListFilter (flag cancelledBySellerAfterAccept).
      return null;
    default:
      return null;
  }
}

async function resolveSellerShopIds(sellerId) {
  const objectId = toObjectId(sellerId);
  if (!objectId) {
    return [];
  }

  const shops = await ShopProfile.find({
    $or: [{ _id: objectId }, { userId: objectId }],
  })
    .select("_id")
    .lean();

  return shops.map((shop) => shop._id);
}

async function buildProductReservationMatch(objectId) {
  if (!objectId) {
    return null;
  }

  const variantIds = await ProductVariant.find({ ProductId: objectId }).distinct("_id");
  const conditions = [{ productId: objectId }];
  if (variantIds.length) {
    conditions.push({ variantId: { $in: variantIds } });
  }

  return { $or: conditions };
}

const ADMIN_RESERVATION_STATUS_SEARCH = [
  ...buildStatusLabelEntries(RESERVATION_STATUS_LABEL),
  { label: 'Hoàn thành', statuses: [RESERVATION_STATUS.RECEIVED, RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED] },
  { label: 'Đã hủy', statuses: [RESERVATION_STATUS.CANCELLED] },
  { label: 'Giữ hàng', statuses: [RESERVATION_STATUS.WAITING_PICKUP] },
  { label: 'Tranh chấp', statuses: [RESERVATION_STATUS.DISPUTED] },
  { label: 'Chờ xác nhận', statuses: [RESERVATION_STATUS.PENDING] },
];

function buildReservationCodeSearchConditions(search) {
  return buildObjectIdSearchConditions(search);
}

async function buildListFilter(query = {}) {
  const filter = {};
  const search = pickString(query.search);
  const buyerId = toObjectId(query.buyerId);
  const productId = toObjectId(query.productId);
  const sellerId = pickString(query.sellerId);
  const dateFrom = parseDate(query.dateFrom);
  const dateTo = parseDate(query.dateTo, true);
  const tabNormalized = pickString(query.tab).toLowerCase();

  if (tabNormalized === "seller_cancelled" || tabNormalized === "seller_cancel_after_accept") {
    filter.cancelledBySellerAfterAccept = true;
  } else if (tabNormalized === "disputes" || tabNormalized === "dispute") {
    const disputeReservationIds = await ReservationDispute.find({
      $or: [
        { status: DISPUTE_STATUS.PENDING },
        { buyerComplaintAt: { $ne: null } },
        { sellerComplaintAt: { $ne: null } },
      ],
    }).distinct("reservationId");

    const disputeOr = [
      { status: RESERVATION_STATUS.DISPUTED },
      { $expr: { $in: ["$hasDispute", [true, 1, "1"]] } },
    ];
    if (disputeReservationIds.length) {
      disputeOr.push({ _id: { $in: disputeReservationIds } });
    }
    filter.$or = disputeOr;
  } else {
    const tabStatuses = resolveTabStatusFilter(query.tab);
    const statusRaw = pickString(query.status);
    if (tabStatuses?.length) {
      filter.status = tabStatuses.length === 1 ? tabStatuses[0] : { $in: tabStatuses };
    } else if (statusRaw !== "" && Number.isFinite(Number(statusRaw))) {
      filter.status = Number(statusRaw);
    }
  }

  if (buyerId) {
    filter.$and = Array.isArray(filter.$and) ? filter.$and : [];
    filter.$and.push(buyerIdFilter(buyerId));
  }

  if (productId) {
    const productMatch = await buildProductReservationMatch(productId);
    if (productMatch) {
      filter.$and = Array.isArray(filter.$and) ? filter.$and : [];
      filter.$and.push(productMatch);
    }
  }

  if (sellerId) {
    const shopIds = await resolveSellerShopIds(sellerId);
    if (!shopIds.length) {
      filter.shopId = new mongoose.Types.ObjectId();
    } else {
      filter.shopId = { $in: shopIds };
    }
  }

  if (dateFrom || dateTo) {
    filter.CreatedAt = {};
    if (dateFrom) {
      filter.CreatedAt.$gte = dateFrom;
    }
    if (dateTo) {
      filter.CreatedAt.$lte = dateTo;
    }
  }

  if (search) {
    const orConditions = [];
    const { buildMongoTokenFieldFilter } = require("../utils/searchText");
    const shopTokenFilter = buildMongoTokenFieldFilter(search, ["shopName", "shopUsername"], {
      minTokenLength: 1,
    });
    const productTokenFilter = buildMongoTokenFieldFilter(search, ["ProductName"], {
      minTokenLength: 1,
    });

    const matchedUsers = await findUsersByTokenSearch(User, search);
    const matchedUserIds = matchedUsers.map((item) => item._id);
    const [shopsByOwner, shopsByName, matchedProducts] = await Promise.all([
      matchedUserIds.length
        ? ShopProfile.find({ userId: { $in: matchedUserIds } }).select("_id").lean()
        : [],
      shopTokenFilter ? ShopProfile.find(shopTokenFilter).select("_id").lean() : [],
      productTokenFilter ? Product.find(productTokenFilter).select("_id").lean() : [],
    ]);

      const shopIds = [
        ...new Set(
          [...shopsByOwner, ...shopsByName].map((item) => String(item._id)).filter(Boolean)
        ),
      ].map((id) => new mongoose.Types.ObjectId(id));

    orConditions.push(
      { userId: { $in: matchedUserIds } },
      { buyerId: { $in: matchedUserIds } },
      { shopId: { $in: shopIds } },
      { productId: { $in: matchedProducts.map((item) => item._id) } }
    );

    const noteRegex = buildSearchRegex(search, { minLength: 1 });
    if (noteRegex) {
      orConditions.push(
        { note: noteRegex },
        { cancelReason: noteRegex },
        { cancelNote: noteRegex }
      );

      const matchedDisputes = await ReservationDispute.find({
        $or: [{ reason: noteRegex }, { description: noteRegex }],
      })
        .select("reservationId")
        .lean();
      if (matchedDisputes.length) {
        orConditions.push({
          _id: { $in: matchedDisputes.map((row) => row.reservationId).filter(Boolean) },
        });
      }
    }

    orConditions.push(...buildReservationCodeSearchConditions(search));

    const matchedStatuses = resolveStatusesFromLabelSearch(search, ADMIN_RESERVATION_STATUS_SEARCH);
    if (matchedStatuses.length) {
      orConditions.push({ status: { $in: matchedStatuses } });
    }

    if (!productId && mongoose.Types.ObjectId.isValid(search)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(search) });
      orConditions.push({ productId: new mongoose.Types.ObjectId(search) });
    }

    if (orConditions.length) {
      appendUniqueOrConditions(filter, orConditions);
    }
  }

  return filter;
}

async function getReservationStats(extraFilter = {}) {
  const base = { ...extraFilter };
  delete base.status;

  const [
    total,
    waitingPickup,
    received,
    completed,
    autoCompleted,
    disputed,
    pendingSellerConfirmation,
    cancelled,
    sellerCancelledAfterAccept,
  ] = await Promise.all([
    Reservation.countDocuments(base),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.WAITING_PICKUP }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.RECEIVED }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.COMPLETED }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.AUTO_COMPLETED }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.DISPUTED }),
    Reservation.countDocuments({
      ...base,
      status: RESERVATION_STATUS.PENDING,
    }),
    Reservation.countDocuments({ ...base, status: RESERVATION_STATUS.CANCELLED }),
    Reservation.countDocuments({ ...base, cancelledBySellerAfterAccept: true }),
  ]);

  const completedAll = received + completed + autoCompleted;

  return {
    total,
    waitingPickup,
    received,
    completed,
    autoCompleted,
    completedAll,
    disputed,
    pendingSellerConfirmation,
    cancelled,
    sellerCancelledAfterAccept,
    refunded: cancelled,
    rejected: cancelled,
    disputeResolved: 0,
  };
}

function resolveLegacyProductThumbnail(product) {
  if (!product) return "";
  if (Array.isArray(product.Thumbnail)) {
    return product.Thumbnail.map(pickString).filter(Boolean)[0] || "";
  }
  return pickString(product.Thumbnail);
}

function resolveProductThumbnail(product, imageDocs = []) {
  if (!product) return "";
  const { toPublicProductImages } = require("./productService");
  const thumbs = toPublicProductImages(imageDocs).map((image) => image.imageUrl);
  return thumbs[0] || resolveLegacyProductThumbnail(product) || "";
}

function mapListItem(
  reservation,
  { buyer, shop, shopOwner, product, productThumbnail = "", disputeRecord = null } = {}
) {
  const shopName = resolveShopDisplayName(shop, shopOwner);
  const shopUsername = resolveShopUsername(shop, shopOwner);
  const shopAvatar = resolveShopAvatar(shop, shopOwner);
  const reasonLabels = getReservationReasonLabels(reservation);
  const disputeView = disputeViewFromRecord(disputeRecord);

  return {
    id: String(reservation._id),
    code: String(reservation._id).slice(-8).toUpperCase(),
    status: reservation.status,
    statusLabel: RESERVATION_STATUS_LABEL[reservation.status] || "Không rõ",
    quantity: Number(reservation.quantity) || 0,
    reservedPrice: Number(reservation.reservedPrice) || 0,
    agreedPrice: Number(reservation.agreedPrice ?? reservation.reservedPrice) || 0,
    depositAmount: Number(reservation.depositAmount) || 0,
    pickupTime: reservation.pickupTime || null,
    note: reservation.note || "",
    cancelReason: reservation.cancelReason || "",
    cancelNote: reservation.cancelNote || "",
    reasonCode: reasonLabels.reasonCode || "",
    reasonLabelBuyer: reasonLabels.buyer || "",
    reasonLabelSeller: reasonLabels.seller || "",
    cancelledBy: reservation.cancelledBy || "",
    cancelledBySellerAfterAccept: Boolean(reservation.cancelledBySellerAfterAccept),
    sellerCancelImages: Array.isArray(reservation.sellerCancelImages)
      ? reservation.sellerCancelImages.filter(Boolean)
      : [],
    disputeByBuyer: disputeView.disputeByBuyer,
    disputeBySeller: disputeView.disputeBySeller,
    disputedAt: disputeView.disputedAt,
    disputeReason: disputeView.disputeReason,
    disputeReasonLabel: disputeView.disputeReasonLabel,
    disputeDescription: disputeView.disputeDescription,
    dispute: disputeView.hasDispute
      ? {
          reason: disputeView.disputeReason,
          reasonLabel: disputeView.disputeReasonLabel,
          reasonType: disputeView.disputeReason,
          description: disputeView.disputeDescription,
          status: disputeRecord?.status,
        }
      : null,
    latestDispute: disputeView.hasDispute
      ? {
          reason: disputeView.disputeReason,
          reasonLabel: disputeView.disputeReasonLabel,
          reasonType: disputeView.disputeReason,
          description: disputeView.disputeDescription,
          status: disputeRecord?.status,
        }
      : null,
    createdAt: reservation.CreatedAt || reservation.createdAt || null,
    productId: reservation.productId ? String(reservation.productId) : "",
    variantId: reservation.variantId ? String(reservation.variantId) : "",
    buyer: buyer
      ? {
          id: String(buyer._id),
          fullName: buyer.FullName || "",
          userName: buyer.UserName || "",
          email: buyer.Email || "",
          phone: buyer.Phone || "",
          avatar: buyer.Avatar || "",
        }
      : null,
    shop: shop
      ? {
          id: String(shop._id),
          shopName,
          shopUsername,
          avatar: shopAvatar,
          userId: shop.userId ? String(shop.userId) : "",
          address: shop.addressHeThong || shop.address || "",
          phone: shopOwner?.Phone || "",
        }
      : null,
    product: product
      ? {
          id: String(product._id),
          productName: product.ProductName || "",
          thumbnail: productThumbnail || resolveLegacyProductThumbnail(product),
        }
      : null,
  };
}

async function hydrateReservations(reservations) {
  const userIds = [
    ...new Set(
      reservations.map((item) => String(getReservationBuyerId(item) || "")).filter(Boolean)
    ),
  ];
  const shopIds = [
    ...new Set(reservations.map((item) => String(item.shopId || "")).filter(Boolean)),
  ];
  const productIds = [
    ...new Set(reservations.map((item) => String(item.productId || "")).filter(Boolean)),
  ];

  const [users, shops, products] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } })
          .select("FullName UserName Email Phone Avatar")
          .lean()
      : [],
    shopIds.length
      ? ShopProfile.find({ _id: { $in: shopIds } })
          .select("userId description address shopName shopUsername avatar addressHeThong")
          .lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName Thumbnail").lean()
      : [],
  ]);

  const ownerIds = [
    ...new Set(shops.map((item) => String(item.userId || "")).filter(Boolean)),
  ];
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } })
        .select("FullName UserName Phone Avatar")
        .lean()
    : [];

  const userMap = new Map(users.map((item) => [String(item._id), item]));
  const shopMap = new Map(shops.map((item) => [String(item._id), item]));
  const productMap = new Map(products.map((item) => [String(item._id), item]));
  const ownerMap = new Map(owners.map((item) => [String(item._id), item]));

  const { loadProductImagesByProductIds } = require("./productService");
  const imagesByProduct = productIds.length
    ? await loadProductImagesByProductIds(productIds)
    : new Map();

  const disputesMap = await loadDisputesByReservationIds(
    reservations.map((item) => item._id)
  );

  return reservations.map((item) => {
    const shop = shopMap.get(String(item.shopId || ""));
    const product = productMap.get(String(item.productId || ""));
    const productThumbnail = resolveProductThumbnail(
      product,
      imagesByProduct.get(String(item.productId || "")) || []
    );
    return mapListItem(item, {
      buyer: userMap.get(String(getReservationBuyerId(item) || "")),
      shop,
      shopOwner: shop ? ownerMap.get(String(shop.userId || "")) : null,
      product,
      productThumbnail,
      disputeRecord: disputesMap.get(String(item._id)) || null,
    });
  });
}

async function listReservations(query = {}) {
  await processReservationLifecycle();

  const { page, limit, skip } = parsePagination(query);
  const filter = await buildListFilter(query);

  const [total, reservations, stats] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    getReservationStats(),
  ]);

  const items = await hydrateReservations(reservations);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    stats,
  };
}

async function listDisputes(query = {}) {
  return listReservations({
    ...query,
    tab: "disputes",
    status: String(RESERVATION_STATUS.DISPUTED),
  });
}

async function getBuyerStats(userId) {
  if (!userId) {
    return {
      totalReservations: 0,
      successfulReservations: 0,
      previousDisputes: 0,
      averageRating: 0,
      reviewCount: 0,
    };
  }

  const [totalReservations, successfulReservations, previousDisputes, reviewAgg] =
    await Promise.all([
      Reservation.countDocuments({ userId }),
      Reservation.countDocuments({
        userId,
        status: {
          $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED],
        },
      }),
      Reservation.countDocuments({
        userId,
        $or: [{ status: RESERVATION_STATUS.DISPUTED }, { hasDispute: true }],
      }),
      Review.aggregate([
        {
          $match: {
            $and: [{ userId }, notDeletedReviewFilter()],
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
          },
        },
      ]),
    ]);

  const reviewSummary = reviewAgg[0] || {};
  const averageRating = reviewSummary.averageRating
    ? Math.round(Number(reviewSummary.averageRating) * 10) / 10
    : 0;

  return {
    totalReservations,
    successfulReservations,
    previousDisputes,
    averageRating,
    reviewCount: Number(reviewSummary.reviewCount) || 0,
  };
}

async function getShopStats(shopId) {
  if (!shopId) {
    return {
      totalReservations: 0,
      completedOrders: 0,
      previousDisputes: 0,
      averageRating: 0,
      followersCount: 0,
    };
  }

  const [totalReservations, completedOrders, previousDisputes, shop] = await Promise.all([
    Reservation.countDocuments({ shopId }),
    Reservation.countDocuments({
      shopId,
      status: {
        $in: [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.AUTO_COMPLETED],
      },
    }),
    Reservation.countDocuments({
      shopId,
      $or: [{ status: RESERVATION_STATUS.DISPUTED }, { hasDispute: true }],
    }),
    ShopProfile.findById(shopId).select("averageRating followersCount").lean(),
  ]);

  return {
    totalReservations,
    completedOrders,
    previousDisputes,
    averageRating: Number(shop?.averageRating) || 0,
    followersCount: Number(shop?.followersCount) || 0,
  };
}

async function getReservationDetail(reservationId) {
  await processReservationLifecycle();

  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const [publicReservation, shop, buyerStats, shopStats, disputeDoc, disputeReports, adjustments] =
    await Promise.all([
      toPublicReservation(reservation),
      reservation.shopId ? ShopProfile.findById(reservation.shopId).lean() : null,
      getBuyerStats(reservation.userId),
      getShopStats(reservation.shopId),
      ReservationDispute.findOne({ reservationId: objectId }).lean(),
      reservationDisputeService
        .listReservationDisputeReports(null, objectId, { isAdmin: true })
        .catch(() => ({ reports: [] })),
      require("./reservationAdjustmentService").loadAdjustmentsForReservation(objectId),
    ]);

  let shopOwner = null;
  if (shop?.userId) {
    shopOwner = await User.findById(shop.userId)
      .select("FullName UserName Phone Avatar Email")
      .lean();
  }

  const shopName = resolveShopDisplayName(shop, shopOwner);
  const shopUsername = resolveShopUsername(shop, shopOwner);
  const shopAvatar = resolveShopAvatar(shop, shopOwner);
  const adjustmentRows = (adjustments || []).map((row) => ({
    ...row,
    productName: row.productName || publicReservation?.product?.productName || "",
  }));

  return {
    ...publicReservation,
    adjustments: adjustmentRows,
    shopInfo: shop
      ? {
          id: String(shop._id),
          shopName,
          shopUsername,
          userId: shop.userId ? String(shop.userId) : "",
          fullName: shopOwner?.FullName || "",
          userName: shopOwner?.UserName || "",
          email: shopOwner?.Email || "",
          address: shop.addressHeThong || shop.address || "",
          phone: shopOwner?.Phone || "",
          avatar: shopAvatar,
        }
      : null,
    seller: shopOwner
      ? {
          id: String(shopOwner._id),
          fullName: shopOwner.FullName || "",
          userName: shopOwner.UserName || "",
          email: shopOwner.Email || "",
          phone: shopOwner.Phone || "",
          avatar: shopOwner.Avatar || "",
        }
      : null,
    shopName,
    buyerStats,
    sellerStats: shopStats,
    shopStats,
    disputeReports: disputeReports?.reports || [],
    dispute: disputeDoc ? reservationDisputeService.toPublicDispute(disputeDoc) : null,
    auditLogs: (disputeDoc?.auditLogs || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((log, index) => ({
        id: String(log._id || index),
        adminId: log.adminId ? String(log.adminId) : "",
        reservationId: String(objectId),
        action: log.action || "",
        decision: log.decision || "",
        note: log.note || "",
        createdAt: log.createdAt || log.CreatedAt || null,
      })),
  };
}

async function writeAuditLog(adminUser, reservationId, { action, decision, note }) {
  if (!adminUser?._id) {
    throw createServiceError("Không xác định được admin.", 401);
  }

  const dispute = await ReservationDispute.findOne({ reservationId });
  if (!dispute) {
    throw createServiceError("Không tìm thấy khiếu nại của đơn giữ hàng.", 404);
  }

  await appendDisputeAuditLog(dispute, {
    adminId: adminUser._id,
    action,
    decision: decision || "",
    note: pickString(note),
  });
}

function canAdminProcessDispute(reservation) {
  return (
    Number(reservation.status) === RESERVATION_STATUS.DISPUTED &&
    Boolean(reservation.disputed)
  );
}

function requireAdminResolutionNote(note) {
  const text = pickString(note);
  if (text.length < 5) {
    throw createServiceError("Vui lòng nhập nội dung xử lý (ít nhất 5 ký tự).", 400);
  }
  return text;
}

function canRefundReservation(reservation) {
  return canAdminProcessDispute(reservation);
}

async function closePendingDisputeReports(adminUser, reservationId, decision, note) {
  const now = new Date();
  const dispute = await ReservationDispute.findOne({ reservationId });
  if (!dispute) {
    return;
  }
  dispute.adminNote = pickString(note) || dispute.adminNote;
  dispute.resolvedBy = adminUser?._id || dispute.resolvedBy;
  dispute.resolvedAt = now;
  if (decision === "approve_buyer") {
    dispute.status = RESERVATION_DISPUTE_STATUS.BUYER_WIN;
  } else if (decision === "approve_seller") {
    dispute.status = RESERVATION_DISPUTE_STATUS.SELLER_WIN;
  }
  dispute.updatedAt = now;
  await dispute.save();
}

async function refundToBuyer(adminUser, reservationId, { note } = {}) {
  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (!canRefundReservation(reservation)) {
    throw createServiceError(
      "Chỉ xử lý tranh chấp khi cả buyer và seller đã gửi báo cáo. Nếu mới một bên báo cáo, hệ thống tự xử lý sau 24 giờ.",
      400
    );
  }

  const resolutionNote = requireAdminResolutionNote(note);

  await refundDepositIfHeld(reservation);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = reservation.cancelledAt || new Date();
  reservation.cancelReason = resolutionNote || "Admin hoàn cọc cho người mua.";
  reservation.UpdatedAt = new Date();
  await reservation.save();

  await closePendingDisputeReports(adminUser, reservation._id, "approve_buyer", resolutionNote);

  await writeAuditLog(adminUser, reservation._id, {
    action: RESERVATION_AUDIT_ACTION.ADMIN_REFUND_BUYER,
    decision: "buyer_win",
    note: resolutionNote,
  });

  await notifyAdminDisputeResolution(
    reservation,
    resolutionNote,
    "Admin quyết định hoàn cọc cho người mua"
  );

  await emitOrderUpdated(reservation, { action: "admin_refund_buyer" });
  return getReservationDetail(reservation._id);
}

async function releaseToSeller(adminUser, reservationId, { note } = {}) {
  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (!canAdminProcessDispute(reservation)) {
    throw createServiceError(
      "Chỉ xử lý tranh chấp khi cả buyer và seller đã gửi báo cáo. Nếu mới một bên báo cáo, hệ thống tự xử lý sau 24 giờ.",
      400
    );
  }

  const resolutionNote = requireAdminResolutionNote(note);

  const shop = reservation.shopId ? await ShopProfile.findById(reservation.shopId) : null;
  if (!shop) {
    throw createServiceError("Không tìm thấy gian hàng của đơn giữ hàng.", 404);
  }

  const now = new Date();
  // Đền cọc cho seller nhưng KHÔNG tính là bán thành công: trả hàng về kho, đơn vào "Đã hủy".
  await releaseDepositIfHeld(reservation, shop);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.cancelReason =
    resolutionNote || "Admin xử lý tranh chấp: đền cọc cho người bán.";
  reservation.UpdatedAt = now;
  if (resolutionNote) {
    reservation.note = [reservation.note, resolutionNote].filter(Boolean).join(" | ");
  }
  await reservation.save();

  await closePendingDisputeReports(adminUser, reservation._id, "approve_seller", resolutionNote);

  await writeAuditLog(adminUser, reservation._id, {
    action: RESERVATION_AUDIT_ACTION.ADMIN_RELEASE_SELLER,
    decision: "seller_win",
    note: resolutionNote,
  });

  await notifyAdminDisputeResolution(
    reservation,
    resolutionNote,
    "Admin quyết định chuyển cọc cho người bán"
  );

  await emitOrderUpdated(reservation, { action: "admin_release_seller" });
  return getReservationDetail(reservation._id);
}

async function cancelReservation(adminUser, reservationId, reason = "") {
  const objectId = toObjectId(reservationId);
  if (!objectId) {
    throw createServiceError("ID đơn giữ hàng không hợp lệ.", 400);
  }

  const reservation = await Reservation.findById(objectId);
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  const status = Number(reservation.status);
  if (
    status === RESERVATION_STATUS.COMPLETED ||
    status === RESERVATION_STATUS.AUTO_COMPLETED
  ) {
    throw createServiceError("Không thể hủy đơn đã hoàn thành.", 400);
  }
  if (status === RESERVATION_STATUS.CANCELLED || status === RESERVATION_STATUS.REJECTED) {
    return getReservationDetail(reservationId);
  }

  await refundDepositIfHeld(reservation);
  await releaseVariantInventory(reservation);

  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = new Date();
  reservation.cancelReason = pickString(reason) || "Admin hủy đơn.";
  reservation.UpdatedAt = new Date();
  await reservation.save();

  const cancelNote = reservation.cancelReason;
  await notifyReservationBoth(reservation, {
    title: "Admin đã hủy đơn giữ hàng",
    content: `Đơn giữ hàng đã bị admin hủy. Tiền cọc (nếu có) đã được hoàn về ví người mua.\n\nLý do: ${cancelNote}`,
    buyerContent: `Đơn giữ hàng đã bị admin hủy. Tiền cọc (nếu có) đã được hoàn về ví của bạn.\n\nLý do: ${cancelNote}`,
    sellerContent: `Đơn giữ hàng đã bị admin hủy.\n\nLý do: ${cancelNote}`,
  });

  if (adminUser?._id) {
    await writeAuditLog(adminUser, reservation._id, {
      action: RESERVATION_AUDIT_ACTION.ADMIN_REFUND_BUYER,
      decision: "buyer_win",
      note: reservation.cancelReason,
    });
  }

  await emitOrderUpdated(reservation, { action: "admin_cancel" });
  return getReservationDetail(reservationId);
}

module.exports = {
  getReservationStats,
  listReservations,
  listDisputes,
  getReservationDetail,
  refundToBuyer,
  releaseToSeller,
  cancelReservation,
  createServiceError,
};

const mongoose = require("mongoose");
const DealOffer = require("../models/DealOffer");
const Reservation = require("../models/Reservation");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ShopProfile = require("../models/ShopProfile");
const { DEAL_OFFER_STATUS } = require("../constants/dealOfferStatus");
const { RESERVATION_STATUS } = require("../constants/reservationStatus");
const { PRODUCT_STATUS } = require("../constants/productStatus");
const { SHOP_STATUS, SHOP_OPEN } = require("../constants/shopStatus");
const { MESSAGE_TYPE } = require("../constants/messageType");
const { toPublicReservation } = require("./reservationService");
const { formatOfferMessageContent } = require("../utils/offerMessageFormat");
const { createNotification } = require("./notificationService");
const messageService = require("./messageService");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function pickString(value) {
  return String(value || "").trim();
}

function computeDiscountPercent(originalPrice, offeredPrice) {
  if (!originalPrice || originalPrice <= 0) {
    return 0;
  }
  const discount = ((originalPrice - offeredPrice) / originalPrice) * 100;
  return Math.max(0, Math.round(discount * 100) / 100);
}

async function validateProductAndShop(productId, variantId) {
  const product = await Product.findById(productId);
  if (!product || product.Status !== PRODUCT_STATUS.ACTIVE) {
    throw createServiceError("Sản phẩm không khả dụng.", 404);
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant || variant.ProductId?.toString() !== product._id.toString()) {
    throw createServiceError("Biến thể sản phẩm không hợp lệ.", 400);
  }
  if (variant.Status !== undefined && variant.Status !== 1) {
    throw createServiceError("Biến thể sản phẩm không khả dụng.", 400);
  }

  const shop = await ShopProfile.findById(product.ShopId);
  if (!shop) {
    throw createServiceError("Không tìm thấy cửa hàng.", 404);
  }
  if (shop.status !== SHOP_STATUS.ACTIVE) {
    throw createServiceError("Cửa hàng không hoạt động.", 400);
  }
  if (shop.isOpen !== SHOP_OPEN.OPEN) {
    throw createServiceError("Cửa hàng đang đóng cửa.", 400);
  }

  return { product, variant, shop };
}

async function toPublicDeal(deal) {
  const [product, variant, shop] = await Promise.all([
    Product.findById(deal.productId),
    ProductVariant.findById(deal.variantId),
    ShopProfile.findById(deal.shopId),
  ]);

  return {
    id: deal._id,
    status: deal.status,
    originalPrice: deal.originalPrice || 0,
    offeredPrice: deal.offeredPrice || 0,
    sellerCounterPrice: deal.sellerCounterPrice || null,
    discountPercent: deal.discountPercent || 0,
    note: deal.note || "",
    sellerNote: deal.sellerNote || "",
    respondedAt: deal.respondedAt || null,
    createdAt: deal.CreatedAt,
    reservationId: deal.reservationId || null,
    productId: deal.productId,
    variantId: deal.variantId,
    shopId: deal.shopId,
    productName: product?.ProductName || "",
    productThumbnail: product?.Thumbnail || "",
    variantName: variant?.VariantName || "",
    storeName: shop?.shopName || shop?.description || "",
    shopUsername: shop?.shopUsername || "",
  };
}

async function sendOfferChatMessage(user, shop, deal) {
  const product = await Product.findById(deal.productId);
  const content = formatOfferMessageContent({
    productName: product?.ProductName || "",
    originalPrice: deal.originalPrice,
    offeredPrice: deal.offeredPrice,
    discountPercent: deal.discountPercent,
    note: deal.note || "",
  });

  const { conversation } = await messageService.findOrCreateBuyerConversation(
    user,
    String(shop._id),
    shop.shopName || ""
  );

  await messageService.sendBuyerMessage(user, conversation._id, {
    content,
    messageType: MESSAGE_TYPE.OFFER,
  });

  return conversation._id;
}

async function notifyShopOwner(shop, { title, content }) {
  if (!shop?.userId) {
    return;
  }
  await createNotification(shop.userId, { title, content });
}

async function createDealOffer(user, payload) {
  const productId = pickString(payload.productId);
  const variantId = pickString(payload.variantId);
  const offeredPrice = pickNumber(payload.offeredPrice ?? payload.offered_price);
  const note = pickString(payload.note);

  if (!productId || !variantId) {
    throw createServiceError("Thiếu sản phẩm hoặc biến thể.");
  }
  if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) {
    throw createServiceError("Giá đề nghị không hợp lệ.");
  }

  const { product, variant, shop } = await validateProductAndShop(productId, variantId);
  const originalPrice = Number(variant.Price) || 0;

  if (offeredPrice >= originalPrice) {
    throw createServiceError("Giá đề nghị phải thấp hơn giá niêm yết.");
  }

  const existingPending = await DealOffer.findOne({
    userId: user._id,
    productId: product._id,
    variantId: variant._id,
    status: DEAL_OFFER_STATUS.PENDING,
  });
  if (existingPending) {
    throw createServiceError("Bạn đã có đề nghị đang chờ xử lý cho sản phẩm này.");
  }

  const now = new Date();
  const discountPercent = computeDiscountPercent(originalPrice, offeredPrice);

  const deal = await DealOffer.create({
    productId: product._id,
    variantId: variant._id,
    userId: user._id,
    shopId: shop._id,
    originalPrice,
    offeredPrice,
    discountPercent,
    note,
    status: DEAL_OFFER_STATUS.PENDING,
    CreatedAt: now,
    UpdatedAt: now,
  });

  await sendOfferChatMessage(user, shop, deal);

  await notifyShopOwner(shop, {
    title: "Đề nghị deal giá mới",
    content: `${user.FullName || user.UserName} đề nghị ${offeredPrice.toLocaleString("vi-VN")}đ cho ${product.ProductName}.`,
  });

  return toPublicDeal(deal);
}

async function listBuyerDeals(user, { status, search } = {}) {
  const query = { userId: user._id };

  if (status !== undefined && status !== null && status !== "") {
    query.status = Number(status);
  }

  let deals = await DealOffer.find(query).sort({ CreatedAt: -1 }).limit(100);
  const mapped = await Promise.all(deals.map(toPublicDeal));

  const keyword = pickString(search).toLowerCase();
  if (!keyword) {
    return mapped;
  }

  return mapped.filter(
    (deal) =>
      deal.productName.toLowerCase().includes(keyword) ||
      deal.storeName.toLowerCase().includes(keyword) ||
      deal.variantName.toLowerCase().includes(keyword)
  );
}

async function getBuyerDeal(user, dealId) {
  const deal = await DealOffer.findOne({ _id: dealId, userId: user._id });
  if (!deal) {
    throw createServiceError("Không tìm thấy deal giá.", 404);
  }
  return toPublicDeal(deal);
}

async function resubmitDealOffer(user, dealId, payload) {
  const deal = await DealOffer.findOne({ _id: dealId, userId: user._id });
  if (!deal) {
    throw createServiceError("Không tìm thấy deal giá.", 404);
  }
  if (deal.status !== DEAL_OFFER_STATUS.REJECTED) {
    throw createServiceError("Chỉ có thể gửi lại đề nghị đã bị từ chối.");
  }

  const offeredPrice = pickNumber(payload.offeredPrice ?? payload.offered_price);
  const note = pickString(payload.note ?? deal.note);

  if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) {
    throw createServiceError("Giá đề nghị không hợp lệ.");
  }

  const { product, variant, shop } = await validateProductAndShop(deal.productId, deal.variantId);
  const originalPrice = Number(variant.Price) || 0;

  if (offeredPrice >= originalPrice) {
    throw createServiceError("Giá đề nghị phải thấp hơn giá niêm yết.");
  }

  const now = new Date();
  deal.offeredPrice = offeredPrice;
  deal.originalPrice = originalPrice;
  deal.discountPercent = computeDiscountPercent(originalPrice, offeredPrice);
  deal.note = note;
  deal.sellerCounterPrice = null;
  deal.sellerNote = "";
  deal.status = DEAL_OFFER_STATUS.PENDING;
  deal.respondedAt = null;
  deal.reservationId = null;
  deal.UpdatedAt = now;
  await deal.save();

  await sendOfferChatMessage(user, shop, deal);

  await notifyShopOwner(shop, {
    title: "Đề nghị deal giá mới",
    content: `${user.FullName || user.UserName} gửi lại đề nghị ${offeredPrice.toLocaleString("vi-VN")}đ cho ${product.ProductName}.`,
  });

  return toPublicDeal(deal);
}

async function acceptCounterOffer(user, dealId) {
  const deal = await DealOffer.findOne({ _id: dealId, userId: user._id });
  if (!deal) {
    throw createServiceError("Không tìm thấy deal giá.", 404);
  }
  if (deal.status !== DEAL_OFFER_STATUS.PENDING) {
    throw createServiceError("Deal này đã được xử lý.");
  }
  if (!deal.sellerCounterPrice) {
    throw createServiceError("Shop chưa đề xuất mức giá mới.");
  }

  const shop = await ShopProfile.findById(deal.shopId);
  const finalPrice = deal.sellerCounterPrice;
  const now = new Date();

  deal.status = DEAL_OFFER_STATUS.ACCEPTED;
  deal.respondedAt = now;
  deal.UpdatedAt = now;
  await deal.save();

  await notifyShopOwner(shop, {
    title: "Khách chấp nhận giá đề xuất",
    content: `${user.FullName || user.UserName} đã chấp nhận mức giá ${finalPrice.toLocaleString("vi-VN")}đ.`,
  });

  return toPublicDeal(deal);
}

async function createReservation(user, payload) {
  const productId = pickString(payload.productId);
  const variantId = pickString(payload.variantId);
  const dealOfferId = pickString(payload.dealOfferId);
  const quantity = pickNumber(payload.quantity) || 1;
  const note = pickString(payload.note);
  const pickupTimeRaw = payload.pickupTime ?? payload.pickup_time;

  if (!productId || !variantId) {
    throw createServiceError("Thiếu sản phẩm hoặc biến thể.");
  }
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw createServiceError("Số lượng không hợp lệ.");
  }

  let pickupTime = null;
  if (pickupTimeRaw) {
    pickupTime = new Date(pickupTimeRaw);
    if (Number.isNaN(pickupTime.getTime())) {
      throw createServiceError("Thời gian nhận hàng không hợp lệ.");
    }
    if (pickupTime.getTime() <= Date.now()) {
      throw createServiceError("Thời gian nhận hàng phải ở tương lai.");
    }
  } else {
    throw createServiceError("Vui lòng chọn thời gian nhận hàng.");
  }

  const { product, variant, shop } = await validateProductAndShop(productId, variantId);

  if ((variant.Quantity ?? 0) < quantity) {
    throw createServiceError("Số lượng vượt quá tồn kho.", 400);
  }

  let agreedPrice = Number(variant.Price) || 0;
  let linkedDealId = null;

  if (dealOfferId) {
    const deal = await DealOffer.findOne({
      _id: dealOfferId,
      userId: user._id,
      productId: product._id,
      variantId: variant._id,
    });
    if (!deal) {
      throw createServiceError("Deal giá không hợp lệ.", 400);
    }
    if (deal.status !== DEAL_OFFER_STATUS.ACCEPTED) {
      throw createServiceError("Deal giá chưa được chấp nhận.", 400);
    }
    if (deal.reservationId) {
      throw createServiceError("Deal này đã có yêu cầu giữ hàng.", 400);
    }
    agreedPrice = deal.sellerCounterPrice || deal.offeredPrice || agreedPrice;
    linkedDealId = deal._id;
  }

  const now = new Date();
  const session = await mongoose.startSession();

  try {
    let reservation;
    await session.withTransaction(async () => {
      reservation = await Reservation.create(
        [
          {
            variantId: variant._id,
            shopId: shop._id,
            productId: product._id,
            userId: user._id,
            dealOfferId: linkedDealId,
            quantity,
            reservedPrice: Number(variant.Price) || 0,
            agreedPrice,
            pickupTime,
            note,
            status: RESERVATION_STATUS.PENDING,
            CreatedAt: now,
            UpdatedAt: now,
          },
        ],
        { session }
      );
      reservation = reservation[0];

      if (linkedDealId) {
        await DealOffer.findByIdAndUpdate(
          linkedDealId,
          { $set: { reservationId: reservation._id, UpdatedAt: now } },
          { session }
        );
      }
    });

    await notifyShopOwner(shop, {
      title: "Yêu cầu giữ hàng mới",
      content: `${user.FullName || user.UserName} yêu cầu giữ ${quantity} ${product.ProductName} — nhận lúc ${pickupTime.toLocaleString("vi-VN")}.`,
    });

    return toPublicReservation(reservation);
  } finally {
    session.endSession();
  }
}

async function listBuyerReservations(user, { tab = "holding", search } = {}) {
  let statusFilter = [];

  switch (tab) {
    case "holding":
      statusFilter = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];
      break;
    case "cancelled":
      statusFilter = [RESERVATION_STATUS.CANCELLED];
      break;
    case "completed":
      statusFilter = [RESERVATION_STATUS.COMPLETED];
      break;
    default:
      statusFilter = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED];
  }

  const reservations = await Reservation.find({
    userId: user._id,
    status: { $in: statusFilter },
  })
    .sort({ UpdatedAt: -1 })
    .limit(100);

  let mapped = await Promise.all(
    reservations.map(async (doc) => {
      const publicReservation = await toPublicReservation(doc);
      const shop = await ShopProfile.findById(doc.shopId);
      return {
        ...publicReservation,
        shopId: doc.shopId ? String(doc.shopId) : "",
        storeName: shop?.shopName || shop?.description || "",
      };
    })
  );

  const keyword = pickString(search).toLowerCase();
  if (keyword) {
    mapped = mapped.filter(
      (item) =>
        (item.product?.productName || "").toLowerCase().includes(keyword) ||
        (item.variant?.variantName || "").toLowerCase().includes(keyword)
    );
  }

  return mapped;
}

async function listBuyerOrders(user, { tab = "holding", search } = {}) {
  if (tab === "pending_price") {
    const deals = await listBuyerDeals(user, { search });
    return { tab, deals, reservations: [] };
  }

  const reservations = await listBuyerReservations(user, { tab, search });
  return { tab, deals: [], reservations };
}

async function getBuyerReservation(user, reservationId) {
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }
  return toPublicReservation(reservation);
}

async function cancelReservationByBuyer(user, reservationId) {
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (reservation.status === RESERVATION_STATUS.COMPLETED) {
    throw createServiceError("Đơn đã hoàn thành, không thể hủy.");
  }
  if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    throw createServiceError("Đơn đã được hủy.");
  }
  if (![RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED].includes(reservation.status)) {
    throw createServiceError("Không thể hủy đơn ở trạng thái này.");
  }

  if (reservation.cancelLockedAt && new Date() < new Date(reservation.cancelLockedAt)) {
    const waitMinutes = Math.ceil(
      (new Date(reservation.cancelLockedAt).getTime() - Date.now()) / 60000
    );
    throw createServiceError(
      `Không thể hủy trong ${waitMinutes} phút đầu sau khi shop chấp nhận giá.`,
      403
    );
  }

  const now = new Date();
  reservation.status = RESERVATION_STATUS.CANCELLED;
  reservation.cancelledAt = now;
  reservation.UpdatedAt = now;
  await reservation.save();

  const shop = await ShopProfile.findById(reservation.shopId);
  await notifyShopOwner(shop, {
    title: "Khách hủy giữ hàng",
    content: `${user.FullName || user.UserName} đã hủy yêu cầu giữ hàng.`,
  });

  return toPublicReservation(reservation);
}

async function completeReservationByBuyer(user, reservationId) {
  const reservation = await Reservation.findOne({ _id: reservationId, userId: user._id });
  if (!reservation) {
    throw createServiceError("Không tìm thấy đơn giữ hàng.", 404);
  }

  if (reservation.status === RESERVATION_STATUS.COMPLETED) {
    throw createServiceError("Đơn đã được đánh dấu hoàn thành.");
  }
  if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    throw createServiceError("Đơn đã bị hủy.");
  }
  if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
    throw createServiceError("Shop chưa xác nhận đơn. Vui lòng đợi shop xác nhận trước khi lấy hàng.");
  }

  const shop = await ShopProfile.findById(reservation.shopId);
  const now = new Date();
  reservation.status = RESERVATION_STATUS.COMPLETED;
  reservation.completedAt = now;
  reservation.UpdatedAt = now;
  await reservation.save();

  const soldQuantity = Number(reservation.quantity) || 1;
  if (shop) {
    shop.soldCount = (shop.soldCount || 0) + soldQuantity;
    shop.UpdatedAt = now;
    await shop.save();
    await notifyShopOwner(shop, {
      title: "Khách đã lấy hàng",
      content: `${user.FullName || user.UserName} đã xác nhận nhận hàng thành công.`,
    });
  }

  if (reservation.productId) {
    await Product.findByIdAndUpdate(reservation.productId, {
      $inc: { SoldCount: soldQuantity },
      $set: { UpdatedAt: now },
    });
  }

  return toPublicReservation(reservation);
}

module.exports = {
  createDealOffer,
  listBuyerDeals,
  getBuyerDeal,
  resubmitDealOffer,
  acceptCounterOffer,
  createReservation,
  listBuyerReservations,
  listBuyerOrders,
  getBuyerReservation,
  cancelReservationByBuyer,
  completeReservationByBuyer,
  toPublicDeal,
  computeDiscountPercent,
};

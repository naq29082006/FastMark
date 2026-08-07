const ShopProfile = require("../models/ShopProfile");
const Product = require("../models/Product");
const { NOTIFICATION_AUDIENCE } = require("../constants");
const { createNotification, NOTIFICATION_INDEX } = require("./notificationService");
const { buildOrderCode } = require("../utils/pickupQr");

async function resolveShop(reservation, shop = null) {
  if (shop?.userId) {
    return shop;
  }
  if (!reservation?.shopId) {
    return null;
  }
  return ShopProfile.findById(reservation.shopId).select("userId shopName").lean();
}

async function resolveProductName(reservation) {
  if (!reservation?.productId) {
    return "sản phẩm";
  }
  const product = await Product.findById(reservation.productId).select("ProductName").lean();
  return product?.ProductName || "sản phẩm";
}

async function notifyReservationBuyer(reservation, { title, content }) {
  if (!reservation?.userId) {
    return;
  }
  await createNotification(reservation.userId, {
    title: String(title || "").trim(),
    content: String(content || "").trim(),
    audience: NOTIFICATION_AUDIENCE.BUYER,
    index: NOTIFICATION_INDEX.ORDER,
  });
}

async function notifyReservationSeller(reservation, shop, { title, content }) {
  const resolvedShop = await resolveShop(reservation, shop);
  if (!resolvedShop?.userId) {
    return;
  }
  await createNotification(resolvedShop.userId, {
    title: String(title || "").trim(),
    content: String(content || "").trim(),
    audience: NOTIFICATION_AUDIENCE.SELLER,
    index: NOTIFICATION_INDEX.ORDER,
  });
}

async function notifyReservationBoth(reservation, { title, content, buyerContent, sellerContent, shop = null }) {
  const buyerText = String(buyerContent || content || "").trim();
  const sellerText = String(sellerContent || content || "").trim();
  if (!buyerText && !sellerText) {
    return;
  }
  const resolvedShop = await resolveShop(reservation, shop);
  if (buyerText) {
    await notifyReservationBuyer(reservation, { title, content: buyerText });
  }
  if (sellerText) {
    await notifyReservationSeller(reservation, resolvedShop, { title, content: sellerText });
  }
}

async function notifyAdminDisputeResolution(reservation, adminMessage, outcomeLabel) {
  const productName = await resolveProductName(reservation);
  const title = "Admin đã xử lý tranh chấp";
  const content = [
    `Đơn giữ hàng "${productName}": ${outcomeLabel}.`,
    "",
    "Nội dung admin:",
    String(adminMessage || "").trim(),
  ].join("\n");
  await notifyReservationBoth(reservation, { title, content });
}

/** Seller: cọc treo escrow đã giải phóng vào ví (sau hạn bảo vệ hoặc tương đương). */
async function notifySellerDepositReleased(reservation, shop = null, { title, content } = {}) {
  const resolvedShop = await resolveShop(reservation, shop);
  if (!resolvedShop?.userId) {
    return;
  }
  const productName = await resolveProductName(reservation);
  const orderCode = buildOrderCode(reservation._id || reservation.id);
  const amount = Math.max(0, Math.round(Number(reservation.depositAmount) || 0));
  const amountLabel = amount > 0 ? `${amount.toLocaleString("vi-VN")}đ` : "cọc";

  const resolvedTitle = String(title || "Tiền cọc đã về ví").trim();
  const resolvedContent =
    String(content || "").trim() ||
    `Tiền ${amountLabel} của đơn ${orderCode || "giữ hàng"} (${productName}) đã chuyển vào ví gian hàng FastMark.`;

  await notifyReservationSeller(reservation, resolvedShop, {
    title: resolvedTitle,
    content: resolvedContent,
  });
}

module.exports = {
  notifyReservationBuyer,
  notifyReservationSeller,
  notifyReservationBoth,
  notifyAdminDisputeResolution,
  notifySellerDepositReleased,
  resolveProductName,
};

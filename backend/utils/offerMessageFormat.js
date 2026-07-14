function formatPriceVnd(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatOfferMessageContent({
  productName = "",
  originalPrice = 0,
  offeredPrice = 0,
  quantity = 1,
  discountPercent = 0,
  note = "",
} = {}) {
  const lines = [
    "💰 Đề nghị deal giá",
    productName ? `Sản phẩm: ${productName}` : "",
    `Số lượng: ${quantity}`,
    `Tổng niêm yết: ${formatPriceVnd(originalPrice)}`,
    `Tổng đề nghị: ${formatPriceVnd(offeredPrice)}`,
    `Giảm: ${discountPercent || 0}%`,
  ].filter(Boolean);

  if (note) {
    lines.push(`Ghi chú: ${note}`);
  }

  return lines.join("\n");
}

function formatBuyerCounterMessageContent({
  productName = "",
  originalPrice = 0,
  sellerCounterPrice = 0,
  offeredPrice = 0,
  quantity = 1,
  discountPercent = 0,
  note = "",
} = {}) {
  const lines = [
    "💰 Khách trả giá lại",
    productName ? `Sản phẩm: ${productName}` : "",
    `Số lượng: ${quantity}`,
    `Tổng niêm yết: ${formatPriceVnd(originalPrice)}`,
    `Shop đề xuất: ${formatPriceVnd(sellerCounterPrice)}`,
    `Tổng đề nghị mới: ${formatPriceVnd(offeredPrice)}`,
    `Giảm: ${discountPercent || 0}%`,
  ].filter(Boolean);

  if (note) {
    lines.push(`Ghi chú: ${note}`);
  }

  return lines.join("\n");
}

function formatSellerCounterMessageContent({
  productName = "",
  originalPrice = 0,
  offeredPrice = 0,
  sellerCounterPrice = 0,
  quantity = 1,
  note = "",
} = {}) {
  const lines = [
    "🏪 Shop trả giá",
    productName ? `Sản phẩm: ${productName}` : "",
    `Số lượng: ${quantity}`,
    `Tổng niêm yết: ${formatPriceVnd(originalPrice)}`,
    `Khách đề nghị: ${formatPriceVnd(offeredPrice)}`,
    `Shop đề xuất: ${formatPriceVnd(sellerCounterPrice)}`,
  ].filter(Boolean);

  if (note) {
    lines.push(`Ghi chú: ${note}`);
  }

  return lines.join("\n");
}

function parseOfferMessageContent(content) {
  const raw = String(content || "").trim();
  if (!raw) {
    return "";
  }

  if (!raw.startsWith("{")) {
    return raw;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === "deal_offer" || parsed?.offeredPrice !== undefined) {
      return formatOfferMessageContent({
        productName: parsed.productName || "",
        originalPrice: parsed.originalPrice,
        offeredPrice: parsed.offeredPrice,
        discountPercent: parsed.discountPercent,
        note: parsed.note || "",
      });
    }
  } catch {
    return raw;
  }

  return raw;
}

module.exports = {
  formatOfferMessageContent,
  formatBuyerCounterMessageContent,
  formatSellerCounterMessageContent,
  parseOfferMessageContent,
  formatPriceVnd,
};

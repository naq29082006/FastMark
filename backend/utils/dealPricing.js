const MAX_DEAL_DISCOUNT_PERCENT = 50;

function computeDiscountPercent(originalTotal, offeredTotal) {
  if (!originalTotal || originalTotal <= 0) {
    return 0;
  }
  const discount = ((originalTotal - offeredTotal) / originalTotal) * 100;
  return Math.max(0, Math.round(discount * 100) / 100);
}

function assertDealDiscountAllowed(originalTotal, offeredTotal) {
  if (!Number.isFinite(offeredTotal) || offeredTotal <= 0) {
    throw Object.assign(new Error("Tổng đề nghị không hợp lệ."), { statusCode: 400 });
  }
  if (!Number.isFinite(originalTotal) || originalTotal <= 0) {
    throw Object.assign(new Error("Tổng niêm yết không hợp lệ."), { statusCode: 400 });
  }
  if (offeredTotal >= originalTotal) {
    throw Object.assign(
      new Error(
        `Tổng đề nghị phải thấp hơn tổng niêm yết (${Number(originalTotal).toLocaleString("vi-VN")}đ).`
      ),
      { statusCode: 400 }
    );
  }
  const discountPercent = computeDiscountPercent(originalTotal, offeredTotal);
  if (discountPercent > MAX_DEAL_DISCOUNT_PERCENT) {
    throw Object.assign(
      new Error(`Không được deal giảm quá ${MAX_DEAL_DISCOUNT_PERCENT}%.`),
      { statusCode: 400 }
    );
  }
}

/**
 * New deals store offeredPrice / sellerCounterPrice as order TOTALS.
 * originalPrice remains the unit list price.
 * Legacy deals stored offered as unit (<= original unit).
 */
function resolveDealMoney(deal) {
  const qty = Math.max(1, Number(deal.quantity) || 1);
  const originalUnit = Number(deal.originalPrice) || 0;
  const originalTotal = originalUnit * qty;
  let offeredTotal = Number(deal.offeredPrice) || 0;
  let sellerCounterTotal =
    deal.sellerCounterPrice != null && deal.sellerCounterPrice !== ""
      ? Number(deal.sellerCounterPrice)
      : null;

  const looksLikeLegacyUnit =
    originalUnit > 0 && offeredTotal > 0 && offeredTotal <= originalUnit + 0.0001;

  if (looksLikeLegacyUnit) {
    offeredTotal = Math.round(offeredTotal * qty);
    if (
      sellerCounterTotal != null &&
      Number.isFinite(sellerCounterTotal) &&
      sellerCounterTotal <= originalUnit + 0.0001
    ) {
      sellerCounterTotal = Math.round(sellerCounterTotal * qty);
    }
  }

  const agreedTotal =
    sellerCounterTotal != null && Number.isFinite(sellerCounterTotal)
      ? sellerCounterTotal
      : offeredTotal;

  return {
    qty,
    originalUnit,
    originalTotal,
    offeredTotal,
    sellerCounterTotal: Number.isFinite(sellerCounterTotal) ? sellerCounterTotal : null,
    agreedTotal,
    agreedUnitPrice: qty > 0 ? Math.round(agreedTotal / qty) : 0,
  };
}

module.exports = {
  MAX_DEAL_DISCOUNT_PERCENT,
  computeDiscountPercent,
  assertDealDiscountAllowed,
  resolveDealMoney,
};

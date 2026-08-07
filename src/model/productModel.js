function normalizeThumbnails(row) {
  if (Array.isArray(row.thumbnails) && row.thumbnails.length > 0) {
    return row.thumbnails.map((url) => String(url || '').trim()).filter(Boolean);
  }
  const single = String(row.thumbnail || '').trim();
  return single ? [single] : [];
}

function computePromoPrice(minPrice, discountPercent) {
  const base = Number(minPrice) || 0;
  const percent = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  if (base <= 0 || percent <= 0) return null;
  return Math.max(0, Math.round(base * (1 - percent / 100)));
}

export function normalizeProduct(row) {
  const minPrice = Number(row.minPrice ?? row.price ?? 0);
  const maxPrice = Number(row.maxPrice ?? row.price ?? minPrice);
  const distanceMeters =
    row.distanceMeters == null || row.distanceMeters === ''
      ? row.distance_meters == null || row.distance_meters === ''
        ? null
        : Number(row.distance_meters)
      : Number(row.distanceMeters);
  const thumbnails = normalizeThumbnails(row);
  const thumbnail = thumbnails[0] || '';
  const isPromotion = Boolean(row.isPromotion);
  const discountPercent = isPromotion ? Math.max(0, Number(row.discountPercent) || 0) : 0;
  const originalPrice = minPrice;
  const originalMaxPrice = maxPrice || minPrice;
  const promotionMinPrice = isPromotion
    ? computePromoPrice(minPrice, discountPercent) ??
      (Number(row.promotionMinPrice ?? row.promotionPrice ?? row.displayPrice) || null)
    : null;
  const promotionMaxPrice = isPromotion
    ? computePromoPrice(originalMaxPrice, discountPercent) ??
      (Number(row.promotionMaxPrice) || promotionMinPrice)
    : null;
  const promotionPrice = promotionMinPrice;

  return {
    id: String(row.id),
    store_id: String(row.store_id ?? row.shopId ?? ''),
    name: row.name ?? row.productName ?? '',
    price: isPromotion && promotionPrice != null ? promotionPrice : minPrice,
    minPrice,
    maxPrice: maxPrice || minPrice,
    originalPrice,
    originalMaxPrice,
    isPromotion,
    promotionPrice,
    promotionMinPrice,
    promotionMaxPrice,
    discountPercent,
    promotionStartDate: row.promotionStartDate || null,
    promotionEndDate: row.promotionEndDate || null,
    pinProduct: Math.max(0, Math.min(2, Number(row.pinProduct) || 0)),
    displayPrice: isPromotion && promotionPrice != null ? promotionPrice : minPrice,
    description: row.description || '',
    image_emoji: row.image_emoji || (thumbnail ? '🖼️' : '📦'),
    thumbnails,
    thumbnail,
    donVi: row.donVi || '',
    categoryName: row.categoryName || '',
    categoryId: String(row.categoryId || row.CategoryId || '').trim(),
    storeName: row.storeName || row.shopName || row.shop_name || '',
    location: row.location || '',
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
    soldCount: Number(row.soldCount ?? 0),
    viewCount: Number(row.viewCount ?? 0),
    likeCount: Number(row.likeCount ?? 0),
    remainingQuantity:
      row.remainingQuantity == null ? null : Math.max(0, Number(row.remainingQuantity) || 0),
    isOutOfStock:
      Boolean(row.isOutOfStock) ||
      ((row.variants || []).length > 0 &&
        (row.variants || []).reduce(
          (sum, variant) => sum + Math.max(0, Number(variant.quantity ?? variant.Quantity) || 0),
          0
        ) <= 0) ||
      (Number(row.variantCount) > 0 &&
        row.remainingQuantity != null &&
        Number(row.remainingQuantity) <= 0),
    isUnavailable: Boolean(row.isUnavailable) || Number(row.status) === 0,
    status: typeof row.status === 'number' ? row.status : row.isUnavailable ? 0 : 1,
    variantCount: Number(row.variantCount ?? row.variants?.length ?? 0),
    variants: (row.variants || []).map(normalizeVariant),
  };
}

function normalizeVariant(variant) {
  const rawImages = variant.images || variant.Images || [];
  const imageUrl =
    String(variant.imageUrl || variant.ImageUrl || '').trim() ||
    String(rawImages[0]?.imageUrl || rawImages[0]?.ImageUrl || '').trim() ||
    '';

  return {
    id: String(variant.id || variant._id || ''),
    variantName: variant.variantName || variant.VariantName || '',
    price: Number(variant.price ?? variant.Price ?? 0),
    quantity: Number(variant.quantity ?? variant.Quantity ?? 0),
    soldCount: Number(variant.soldCount ?? variant.SoldCount ?? 0),
    imageUrl,
    images: imageUrl ? [{ id: '', imageUrl, sortOrder: 0 }] : [],
  };
}

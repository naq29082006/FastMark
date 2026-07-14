export function normalizeProduct(row) {
  const minPrice = Number(row.minPrice ?? row.price ?? 0);
  const maxPrice = Number(row.maxPrice ?? row.price ?? minPrice);
  const distanceMeters =
    row.distanceMeters == null || row.distanceMeters === ''
      ? null
      : Number(row.distanceMeters);

  return {
    id: String(row.id),
    store_id: String(row.store_id ?? row.shopId ?? ''),
    name: row.name ?? row.productName ?? '',
    price: minPrice,
    minPrice,
    maxPrice: maxPrice || minPrice,
    description: row.description || '',
    image_emoji: row.image_emoji || (row.thumbnail ? '🖼️' : '📦'),
    thumbnail: row.thumbnail || '',
    donVi: row.donVi || '',
    categoryName: row.categoryName || '',
    categoryIcon: row.categoryIcon || '',
    storeName: row.storeName || '',
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

function normalizeVariantImage(image) {
  return {
    id: image.id || image._id || '',
    imageUrl: image.imageUrl || image.ImageUrl || '',
    sortOrder: image.sortOrder ?? image.SortOrder ?? 0,
  };
}

function normalizeVariant(variant) {
  return {
    id: String(variant.id || variant._id || ''),
    variantName: variant.variantName || variant.VariantName || '',
    price: Number(variant.price ?? variant.Price ?? 0),
    quantity: Number(variant.quantity ?? variant.Quantity ?? 0),
    soldCount: Number(variant.soldCount ?? variant.SoldCount ?? 0),
    images: (variant.images || variant.Images || []).map(normalizeVariantImage),
  };
}

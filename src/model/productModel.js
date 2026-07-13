export function normalizeProduct(row) {
  const minPrice = Number(row.minPrice ?? row.price ?? 0);
  const maxPrice = Number(row.maxPrice ?? row.price ?? minPrice);

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
    soldCount: Number(row.soldCount ?? 0),
    viewCount: Number(row.viewCount ?? 0),
    likeCount: Number(row.likeCount ?? 0),
    isOutOfStock: Boolean(row.isOutOfStock),
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

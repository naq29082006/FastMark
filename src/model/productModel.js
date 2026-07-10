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
    images: (variant.images || variant.Images || []).map(normalizeVariantImage),
  };
}

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

export function makeFallbackProducts(storeId) {
  return [
    {
      id: `fallback-${storeId}-1`,
      store_id: storeId,
      name: 'Sản phẩm bán chạy',
      price: 35000,
      minPrice: 35000,
      maxPrice: 35000,
      soldCount: 12,
      description: 'Sản phẩm mẫu của gian hàng, dùng để test màn hình chi tiết sản phẩm.',
      image_emoji: '⭐',
    },
    {
      id: `fallback-${storeId}-2`,
      store_id: storeId,
      name: 'Combo tiết kiệm',
      price: 59000,
      minPrice: 49000,
      maxPrice: 59000,
      soldCount: 8,
      description: 'Combo mẫu có giá ưu đãi, phù hợp để kiểm tra danh sách sản phẩm đang bán.',
      image_emoji: '🛍️',
    },
    {
      id: `fallback-${storeId}-3`,
      store_id: storeId,
      name: 'Món mới hôm nay',
      price: 45000,
      minPrice: 45000,
      maxPrice: 45000,
      soldCount: 3,
      description: 'Món mới được tạo tự động khi gian hàng chưa có dữ liệu sản phẩm thật.',
      image_emoji: '🔥',
    },
  ];
}

export function getFallbackProductById(productId) {
  const match = String(productId).match(/^fallback-(.+)-([123])$/);
  if (!match) {
    return null;
  }

  const [, storeId] = match;
  return makeFallbackProducts(storeId).find((product) => product.id === productId) || null;
}

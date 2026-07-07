export function normalizeProduct(row) {
  return {
    id: row.id,
    store_id: row.store_id,
    name: row.name,
    price: row.price,
    description: row.description || '',
    image_emoji: row.image_emoji || '📦',
  };
}

export function makeFallbackProducts(storeId) {
  return [
    {
      id: `fallback-${storeId}-1`,
      store_id: storeId,
      name: 'Sản phẩm bán chạy',
      price: 35000,
      description: 'Sản phẩm mẫu của gian hàng, dùng để test màn hình chi tiết sản phẩm.',
      image_emoji: '⭐',
    },
    {
      id: `fallback-${storeId}-2`,
      store_id: storeId,
      name: 'Combo tiết kiệm',
      price: 59000,
      description: 'Combo mẫu có giá ưu đãi, phù hợp để kiểm tra danh sách sản phẩm đang bán.',
      image_emoji: '🛍️',
    },
    {
      id: `fallback-${storeId}-3`,
      store_id: storeId,
      name: 'Món mới hôm nay',
      price: 45000,
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

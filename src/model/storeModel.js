function pickText(...values) {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) {
      return text;
    }
  }
  return '';
}

export function normalizeStore(row) {
  const ratingAvg = Number(row.rating_avg ?? row.averageRating ?? 0);
  const isRegisteredShop = Boolean(row.is_registered_shop);

  return {
    id: row.id,
    name: row.name || row.shop_name || row.shopName || 'Gian hàng',
    shop_name: row.shop_name || row.shopName || row.name || 'Gian hàng',
    shop_username: row.shop_username || row.shopUsername || '',
    type: row.type || 'shop',
    latitude: row.latitude,
    longitude: row.longitude,
    user_address: pickText(row.address, row.shopAddress),
    address: pickText(row.address, row.shopAddress),
    system_address: pickText(
      row.system_address,
      row.systemAddress,
      row.DiaChiHeThong,
      row.DiachiHethong,
      row.shopSystemAddress
    ),
    phone: pickText(row.phone, row.shopPhone),
    zalo: pickText(row.zalo, row.phone, row.shopPhone),
    intro: isRegisteredShop
      ? pickText(row.intro, row.description, row.shopDescription)
      : pickText(
          row.intro,
          row.description,
          `${row.name} là gian hàng mẫu trên Fastmark. Thông tin này được tạo tự động để test màn chi tiết, danh sách sản phẩm, đánh giá và liên hệ.`
        ),
    open_time: pickText(row.open_time, row.openTime),
    close_time: pickText(row.close_time, row.closeTime),
    is_open: row.is_open !== false && row.is_open !== 0 && row.isOpen !== 0,
    rating_avg: Number.isFinite(ratingAvg) ? ratingAvg : 0,
    review_count: Number(row.review_count ?? row.totalReviews ?? 0),
    follow_count: Number(row.follow_count ?? row.followersCount ?? row.FollowersCount ?? 0),
    product_count: Number(row.total_products ?? row.product_count ?? row.totalProducts ?? 0),
    total_products: Number(row.total_products ?? row.product_count ?? row.totalProducts ?? 0),
    sold_count: Number(row.sold_count ?? row.soldCount ?? 0),
    total_likes: Number(row.total_likes ?? row.totalLikes ?? row.likesCount ?? 0),
    image_url: pickText(row.image_url, row.avatar, row.photoUrl),
    cover_image_url: pickText(
      row.cover_image_url,
      row.coverImage,
      row.anhBia,
      row.image_url,
      row.avatar
    ),
    is_registered_shop: isRegisteredShop,
    distance_meters: row.distance_meters ?? null,
    category_name: row.categoryName || row.category_name || '',
  };
}

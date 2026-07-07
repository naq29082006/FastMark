export function normalizeStore(row) {
  const ratingAvg = Number(row.rating_avg ?? 4.5);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address || '',
    phone: row.phone || '0900000000',
    zalo: row.zalo || row.phone || '0900000000',
    intro:
      row.intro ||
      `${row.name} là gian hàng mẫu trên Fastmark. Thông tin này được tạo tự động để test màn chi tiết, danh sách sản phẩm, đánh giá và liên hệ.`,
    rating_avg: Number.isFinite(ratingAvg) ? ratingAvg : 4.5,
    review_count: Number(row.review_count ?? 12),
    product_count: Number(row.product_count ?? 3),
  };
}

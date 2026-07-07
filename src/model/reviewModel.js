export function normalizeReview(row) {
  return {
    id: row.id,
    store_id: row.store_id,
    user_name: row.user_name || 'Khách hàng',
    rating: row.rating,
    comment: row.comment || '',
    created_at: row.created_at,
  };
}

export function makeFallbackReviews(storeId) {
  return [
    {
      id: `fallback-review-${storeId}-1`,
      store_id: storeId,
      user_name: 'Khách gần đây',
      rating: 5,
      comment: 'Gian hàng phục vụ tốt, thông tin rõ ràng và dễ liên hệ.',
      created_at: '2026-07-01T09:00:00Z',
    },
    {
      id: `fallback-review-${storeId}-2`,
      store_id: storeId,
      user_name: 'Minh Anh',
      rating: 4,
      comment: 'Sản phẩm ổn, giá hợp lý. Sẽ quay lại nếu có dịp.',
      created_at: '2026-06-28T14:30:00Z',
    },
  ];
}

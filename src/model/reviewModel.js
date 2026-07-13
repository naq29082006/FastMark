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

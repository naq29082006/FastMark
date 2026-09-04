import { createLogger } from '../core/utils/logger';
import { fetchReviewsFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { normalizeReview } from '../model/reviewModel';

const log = createLogger('ReviewRepository');

export async function fetchReviewsByStoreId(storeId, { page = 1, limit = 20, productId = '' } = {}) {
  const normalizedProductId = String(productId || '').trim();
  log.info('fetchReviewsByStoreId:start', { storeId, page, limit, productId: normalizedProductId || null });

  if (!hasStoreNodeApi()) {
    log.warn('fetchReviewsByStoreId:no-api', { storeId });
    return { items: [], page, limit, total: 0, hasMore: false };
  }

  try {
    const reviewsPage = await fetchReviewsFromNode(storeId, {
      page,
      limit,
      productId: normalizedProductId,
    });
    let reviews = (reviewsPage.items || []).map(normalizeReview);

    // Defense-in-depth: keep only reviews linked to the requested product.
    if (normalizedProductId) {
      reviews = reviews.filter(
        (review) => String(review.productId || '') === normalizedProductId
      );
    }

    log.ok('fetchReviewsByStoreId:node-api', {
      storeId,
      productId: normalizedProductId || null,
      count: reviews.length,
    });
    return {
      ...reviewsPage,
      items: reviews,
    };
  } catch (error) {
    log.warn('fetchReviewsByStoreId:node-api-failed', error?.message || error);
    return { items: [], page, limit, total: 0, hasMore: false };
  }
}

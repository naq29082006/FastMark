import { getMockReviewsByStoreId } from '../model/mock/storeMockData';
import { createLogger } from '../core/utils/logger';
import { fetchReviewsFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { makeFallbackReviews, normalizeReview } from '../model/reviewModel';

const log = createLogger('ReviewRepository');

export async function fetchReviewsByStoreId(storeId) {
  log.info('fetchReviewsByStoreId:start', { storeId });

  if (hasStoreNodeApi()) {
    try {
      const reviews = await fetchReviewsFromNode(storeId);
      if (reviews.length > 0) {
        log.ok('fetchReviewsByStoreId:node-api', { storeId, count: reviews.length });
        return reviews.map(normalizeReview);
      }
      log.warn('fetchReviewsByStoreId:node-api-empty', { storeId });
    } catch (error) {
      log.fail('fetchReviewsByStoreId:node-api-failed', error);
    }
  }

  const mockReviews = getMockReviewsByStoreId(storeId);
  if (mockReviews.length > 0) {
    log.info('fetchReviewsByStoreId:mock', { storeId, count: mockReviews.length });
    return mockReviews;
  }

  const fallback = makeFallbackReviews(storeId);
  log.info('fetchReviewsByStoreId:fallback', { storeId, count: fallback.length });
  return fallback;
}

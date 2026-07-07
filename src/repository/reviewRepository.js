import { getMockReviewsByStoreId } from '../model/mock/storeMockData';
import { createLogger } from '../core/utils/logger';
import { fetchReviewsFromFirestore } from '../api/reviewApi';
import { makeFallbackReviews } from '../model/reviewModel';

const log = createLogger('ReviewRepository');

export async function fetchReviewsByStoreId(storeId) {
  log.info('fetchReviewsByStoreId:start', { storeId });

  try {
    const reviews = await fetchReviewsFromFirestore(storeId);

    if (reviews.length > 0) {
      log.ok('fetchReviewsByStoreId:firestore', { storeId, count: reviews.length });
      return reviews;
    }

    log.warn('fetchReviewsByStoreId:empty-firestore', { storeId });
  } catch (error) {
    log.fail('fetchReviewsByStoreId:firestore-failed', error);
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

import { createLogger } from '../core/utils/logger';
import { fetchReviewsFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { normalizeReview } from '../model/reviewModel';

const log = createLogger('ReviewRepository');

export async function fetchReviewsByStoreId(storeId) {
  log.info('fetchReviewsByStoreId:start', { storeId });

  if (!hasStoreNodeApi()) {
    log.warn('fetchReviewsByStoreId:no-api', { storeId });
    return [];
  }

  try {
    const reviews = await fetchReviewsFromNode(storeId);
    log.ok('fetchReviewsByStoreId:node-api', { storeId, count: reviews.length });
    return reviews.map(normalizeReview);
  } catch (error) {
    log.fail('fetchReviewsByStoreId:node-api-failed', error);
    return [];
  }
}

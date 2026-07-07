import { MOCK_STORES } from '../model/mock/storeMockData';
import { createLogger } from '../core/utils/logger';
import { fetchRestaurantsFromNode, hasStoreNodeApi } from '../api/storeNodeApi';

const log = createLogger('RestaurantRepository');

export async function fetchRestaurants(type = 'all') {
  log.info('fetchRestaurants:start', { type });

  if (hasStoreNodeApi()) {
    try {
      const data = await fetchRestaurantsFromNode(type);
      if (data && data.length > 0) {
        log.ok('fetchRestaurants:node-api', { type, count: data.length });
        return data;
      }
      log.warn('fetchRestaurants:node-api-empty', { type });
    } catch (error) {
      log.fail('fetchRestaurants:node-api-failed', error);
    }
  }

  const mockData = getFilteredMockRestaurants(type);
  log.info('fetchRestaurants:mock-fallback', { type, count: mockData.length });
  return mockData;
}

function getFilteredMockRestaurants(type) {
  if (type === 'all') {
    return MOCK_STORES;
  }
  return MOCK_STORES.filter((r) => r.type === type);
}

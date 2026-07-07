import { getMockStoreById } from '../model/mock/storeMockData';
import { createLogger } from '../core/utils/logger';
import { fetchStoreFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { normalizeStore } from '../model/storeModel';

const log = createLogger('StoreRepository');

export async function fetchStoreById(storeId) {
  const normalizedId = String(storeId);
  log.info('fetchStoreById:start', { storeId: normalizedId });

  if (hasStoreNodeApi()) {
    try {
      const store = await fetchStoreFromNode(normalizedId);
      if (store) {
        log.ok('fetchStoreById:node-api', { storeId: normalizedId });
        return normalizeStore(store);
      }
      log.warn('fetchStoreById:node-api-not-found', { storeId: normalizedId });
    } catch (error) {
      log.fail('fetchStoreById:node-api-failed', error);
    }
  }

  const mockStore = getMockStoreById(normalizedId);
  if (mockStore) {
    log.ok('fetchStoreById:mock-hit', { storeId: normalizedId, name: mockStore.name });
    return mockStore;
  }

  log.info('fetchStoreById:not-found', { storeId: normalizedId });
  return null;
}

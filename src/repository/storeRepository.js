import { getMockStoreById } from '../model/mock/storeMockData';
import { createLogger } from '../core/utils/logger';
import { fetchStoreFromFirestore } from '../api/storeApi';

const log = createLogger('StoreRepository');

export async function fetchStoreById(storeId) {
  const normalizedId = String(storeId);
  log.info('fetchStoreById:start', { storeId: normalizedId });

  const mockStore = getMockStoreById(normalizedId);
  if (mockStore) {
    log.ok('fetchStoreById:mock-hit', { storeId: normalizedId, name: mockStore.name });
    return mockStore;
  }

  try {
    const store = await fetchStoreFromFirestore(normalizedId);
    if (store) {
      return store;
    }

    log.warn('fetchStoreById:not-found-firestore', { storeId: normalizedId });
  } catch (error) {
    log.fail('fetchStoreById:firestore-failed', error);
  }

  const fallback = getMockStoreById(normalizedId);
  log.info('fetchStoreById:fallback', { storeId: normalizedId, found: Boolean(fallback) });
  return fallback;
}

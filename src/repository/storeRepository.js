import { createLogger } from '../core/utils/logger';
import { fetchStoreFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { normalizeStore } from '../model/storeModel';

const log = createLogger('StoreRepository');

export async function fetchStoreById(storeId, originLocation = null) {
  const normalizedId = String(storeId);
  log.info('fetchStoreById:start', { storeId: normalizedId });

  if (!hasStoreNodeApi()) {
    log.warn('fetchStoreById:no-api', { storeId: normalizedId });
    return null;
  }

  try {
    const store = await fetchStoreFromNode(normalizedId, {
      latitude: originLocation?.latitude,
      longitude: originLocation?.longitude,
    });
    if (store) {
      log.ok('fetchStoreById:node-api', { storeId: normalizedId });
      return normalizeStore(store);
    }
    log.warn('fetchStoreById:node-api-not-found', { storeId: normalizedId });
  } catch (error) {
    log.fail('fetchStoreById:node-api-failed', error);
  }

  return null;
}

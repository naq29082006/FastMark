import { createLogger } from '../core/utils/logger';
import { fetchNearbyShopsFromNode, hasStoreNodeApi } from '../api/storeNodeApi';
import { normalizeStore } from '../model/storeModel';

const log = createLogger('NearbyShopRepository');

export async function fetchNearbyRegisteredShops({ latitude, longitude, radiusMeters = 2000 }) {
  if (!hasStoreNodeApi()) {
    return [];
  }

  try {
    const shops = await fetchNearbyShopsFromNode({ latitude, longitude, radiusMeters });
    log.ok('fetchNearbyRegisteredShops', { count: shops.length, radiusMeters });
    return shops.map(normalizeStore);
  } catch (error) {
    log.fail('fetchNearbyRegisteredShops:failed', error);
    return [];
  }
}

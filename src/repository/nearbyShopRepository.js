import { createLogger } from '../core/utils/logger';
import {
  fetchNearbyShopsFromNode,
  fetchSearchShopsFromNode,
  hasStoreNodeApi,
} from '../api/storeNodeApi';
import { normalizeStore } from '../model/storeModel';

const log = createLogger('NearbyShopRepository');

export async function fetchNearbyRegisteredShops({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopCategoryId = '',
}) {
  if (!hasStoreNodeApi()) {
    return [];
  }

  try {
    const normalizedCategoryId = String(shopCategoryId || '').trim();
    const shops = normalizedCategoryId
      ? (
          await fetchSearchShopsFromNode({
            latitude,
            longitude,
            radiusMeters,
            shopCategoryId: normalizedCategoryId,
          })
        ).shops
      : await fetchNearbyShopsFromNode({ latitude, longitude, radiusMeters });

    log.ok('fetchNearbyRegisteredShops', {
      count: shops.length,
      radiusMeters,
      shopCategoryId: normalizedCategoryId || 'all',
    });
    return shops.map(normalizeStore);
  } catch (error) {
    log.fail('fetchNearbyRegisteredShops:failed', error);
    return [];
  }
}

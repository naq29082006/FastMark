import { createLogger } from '../core/utils/logger';
import {
  fetchNearbyShopsFromNode,
  fetchMapShopsFromNode,
  fetchSearchShopsFromNode,
  hasStoreNodeApi,
} from '../api/storeNodeApi';
import { normalizeStore } from '../model/storeModel';
import { emptyPageResult, normalizePageResult } from '../core/utils/pagination';

const log = createLogger('NearbyShopRepository');

export async function fetchNearbyRegisteredShops({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopCategoryId = '',
  page = 1,
  limit = 20,
  seed = '',
}) {
  if (!hasStoreNodeApi()) {
    return emptyPageResult({ page, limit });
  }

  const normalizedCategoryId = String(shopCategoryId || '').trim();
  const result = normalizedCategoryId
    ? await fetchSearchShopsFromNode({
        latitude,
        longitude,
        radiusMeters,
        shopCategoryId: normalizedCategoryId,
        page,
        limit,
        seed,
      })
    : await fetchNearbyShopsFromNode({
        latitude,
        longitude,
        radiusMeters,
        page,
        limit,
        seed,
      });

  const pageResult = normalizePageResult(result, 'shops');
  const items = pageResult.items.map(normalizeStore);

  log.ok('fetchNearbyRegisteredShops', {
    count: items.length,
    page: pageResult.page,
    hasMore: pageResult.hasMore,
    radiusMeters,
    shopCategoryId: normalizedCategoryId || 'all',
  });

  return {
    ...pageResult,
    items,
    shops: items,
  };
}

export async function fetchMapNearbyShops({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopCategoryId = '',
  limit = 500,
}) {
  if (!hasStoreNodeApi()) {
    return [];
  }

  const result = await fetchMapShopsFromNode({
    latitude,
    longitude,
    radiusMeters,
    shopCategoryId,
    limit,
  });
  const items = (result.items || result.shops || []).map(normalizeStore);

  log.ok('fetchMapNearbyShops', {
    count: items.length,
    total: result.total,
    truncated: result.truncated,
    radiusMeters,
    shopCategoryId: String(shopCategoryId || '').trim() || 'all',
  });

  return items;
}

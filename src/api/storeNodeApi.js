import { apiRequest, hasApiBaseUrl } from './client';
import { API_ENDPOINTS } from './endpoints';
import { createLogger } from '../core/utils/logger';
import { normalizePageResult } from '../core/utils/pagination';

const log = createLogger('StoreNodeApi');

export function hasStoreNodeApi() {
  return hasApiBaseUrl();
}

async function parseJson(response, label) {
  if (!response.ok) {
    const error = new Error(`${label} failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return response.json();
}

function isMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
}

export async function fetchNearbyShopsFromNode({
  latitude,
  longitude,
  radiusMeters = 2000,
  page = 1,
  limit = 20,
  seed = '',
}) {
  if (!hasStoreNodeApi()) {
    return normalizePageResult({}, 'shops');
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radiusMeters),
    page: String(page),
    limit: String(limit),
  });
  if (seed) {
    params.set('seed', String(seed));
  }

  const response = await apiRequest(`${API_ENDPOINTS.shopsNearby}?${params.toString()}`);
  const payload = await parseJson(response, 'fetchNearbyShopsFromNode');
  return normalizePageResult(payload.data || {}, 'shops');
}

export async function fetchMapShopsFromNode({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopCategoryId = '',
  limit = 500,
}) {
  if (!hasStoreNodeApi()) {
    return { items: [], shops: [], total: 0, count: 0, truncated: false };
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radiusMeters),
    limit: String(limit),
  });
  const normalizedCategoryId = String(shopCategoryId || '').trim();
  if (normalizedCategoryId) {
    params.set('shopCategoryId', normalizedCategoryId);
  }

  const response = await apiRequest(`${API_ENDPOINTS.shopsNearbyMap}?${params.toString()}`);
  const payload = await parseJson(response, 'fetchMapShopsFromNode');
  const data = payload.data || {};
  const items = data.items || data.shops || [];
  return {
    items,
    shops: items,
    total: Number(data.total) || items.length,
    count: Number(data.count) || items.length,
    truncated: Boolean(data.truncated),
  };
}

export async function fetchSearchShopsFromNode({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopQuery = '',
  shopCategoryId = '',
  productCategoryId = '',
  productQuery = '',
  identityOnly = false,
  page = 1,
  limit = 20,
}) {
  if (!hasStoreNodeApi()) {
    return normalizePageResult({}, 'shops');
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radiusMeters),
    page: String(page),
    limit: String(limit),
  });

  const trimmedShopQuery = String(shopQuery || '').trim();
  const trimmedProductQuery = String(productQuery || '').trim();
  if (trimmedShopQuery) {
    params.set('q', trimmedShopQuery);
  }
  if (shopCategoryId) {
    params.set('shopCategoryId', String(shopCategoryId));
  }
  if (productCategoryId) {
    params.set('productCategoryId', String(productCategoryId));
  }
  if (trimmedProductQuery) {
    params.set('product', trimmedProductQuery);
  }
  if (identityOnly) {
    params.set('identityOnly', '1');
  }

  const response = await apiRequest(`${API_ENDPOINTS.shopsSearch}?${params.toString()}`);
  const payload = await parseJson(response, 'fetchSearchShopsFromNode');
  return {
    ...normalizePageResult(payload.data || {}, 'shops'),
    shops: payload.data?.shops || [],
    count: payload.data?.count || 0,
    radiusMeters: payload.data?.radius_meters ?? radiusMeters,
  };
}

export async function fetchStoreFromNode(storeId, { latitude, longitude } = {}) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const normalizedId = String(storeId);
  if (!isMongoObjectId(normalizedId)) {
    return null;
  }

  try {
    const params = new URLSearchParams();
    if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
      params.set('lat', String(latitude));
      params.set('lng', String(longitude));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const shopResponse = await apiRequest(`${API_ENDPOINTS.shopById(normalizedId)}${query}`);
    const shopPayload = await parseJson(shopResponse, 'fetchShopFromNode');
    return shopPayload.data?.shop || null;
  } catch (error) {
    if (Number(error?.statusCode) === 404) {
      return null;
    }
    throw error;
  }
}

export async function fetchProductsFromNode(storeId, { page = 1, limit = 20 } = {}) {
  if (!hasStoreNodeApi()) {
    return normalizePageResult({ items: [], page, limit, total: 0, hasMore: false });
  }

  const normalizedId = String(storeId);
  if (!isMongoObjectId(normalizedId)) {
    return normalizePageResult({ items: [], page, limit, total: 0, hasMore: false });
  }

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    const response = await apiRequest(
      `${API_ENDPOINTS.shopProducts(normalizedId)}?${params.toString()}`
    );
    const payload = await parseJson(response, 'fetchShopProductsFromNode');
    return normalizePageResult(
      {
        ...(payload.data || {}),
        items: payload.data?.products || payload.data?.items || [],
      },
      'items'
    );
  } catch (error) {
    if (Number(error?.statusCode) === 404) {
      return normalizePageResult({ items: [], page, limit, total: 0, hasMore: false });
    }
    throw error;
  }
}

export async function fetchProductFromNode(productId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const normalizedId = String(productId);
  if (!isMongoObjectId(normalizedId)) {
    return null;
  }

  const response = await apiRequest(API_ENDPOINTS.productById(normalizedId));
  const payload = await parseJson(response, 'fetchProductFromNode');
  return payload.data?.product || payload.product || null;
}

export async function fetchReviewsFromNode(storeId, { page = 1, limit = 20, productId = '' } = {}) {
  if (!hasStoreNodeApi()) {
    return normalizePageResult({ items: [], page, limit, total: 0, hasMore: false });
  }

  const normalizedId = String(storeId);
  if (!isMongoObjectId(normalizedId)) {
    return normalizePageResult({ items: [], page, limit, total: 0, hasMore: false });
  }

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    const normalizedProductId = String(productId || '').trim();
    if (isMongoObjectId(normalizedProductId)) {
      params.set('productId', normalizedProductId);
    }
    const response = await apiRequest(
      `${API_ENDPOINTS.shopReviews(normalizedId)}?${params.toString()}`
    );
    const payload = await parseJson(response, 'fetchShopReviewsFromNode');
    return normalizePageResult(
      {
        ...(payload.data || {}),
        items: payload.data?.reviews || payload.data?.items || [],
      },
      'items'
    );
  } catch (error) {
    if (Number(error?.statusCode) === 404) {
      return normalizePageResult({ items: [], page, limit, total: 0, hasMore: false });
    }
    throw error;
  }
}

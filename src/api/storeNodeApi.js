import { apiRequest, hasApiBaseUrl } from './client';
import { API_ENDPOINTS } from './endpoints';
import { createLogger } from '../core/utils/logger';

const log = createLogger('StoreNodeApi');

export function hasStoreNodeApi() {
  return hasApiBaseUrl();
}

async function parseJson(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`);
  }
  return response.json();
}

function isMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
}

export async function fetchNearbyShopsFromNode({ latitude, longitude, radiusMeters = 2000 }) {
  if (!hasStoreNodeApi()) {
    return [];
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radiusMeters),
  });

  const response = await apiRequest(`${API_ENDPOINTS.shopsNearby}?${params.toString()}`);
  const payload = await parseJson(response, 'fetchNearbyShopsFromNode');
  return payload.data?.shops || [];
}

export async function fetchSearchShopsFromNode({
  latitude,
  longitude,
  radiusMeters = 2000,
  shopQuery = '',
  shopCategoryId = '',
  productCategoryId = '',
  productQuery = '',
  limit = 50,
}) {
  if (!hasStoreNodeApi()) {
    return { shops: [], count: 0 };
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radiusMeters),
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

  const response = await apiRequest(`${API_ENDPOINTS.shopsSearch}?${params.toString()}`);
  const payload = await parseJson(response, 'fetchSearchShopsFromNode');
  return {
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

  const params = new URLSearchParams();
  if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
    params.set('lat', String(latitude));
    params.set('lng', String(longitude));
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  const shopResponse = await apiRequest(`${API_ENDPOINTS.shopById(normalizedId)}${query}`);
  const shopPayload = await parseJson(shopResponse, 'fetchShopFromNode');
  return shopPayload.data?.shop || null;
}

export async function fetchProductsFromNode(storeId) {
  if (!hasStoreNodeApi()) {
    return [];
  }

  const normalizedId = String(storeId);
  if (!isMongoObjectId(normalizedId)) {
    return [];
  }

  const response = await apiRequest(API_ENDPOINTS.shopProducts(normalizedId));
  const payload = await parseJson(response, 'fetchShopProductsFromNode');
  return payload.data?.products || [];
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

export async function fetchReviewsFromNode(storeId) {
  if (!hasStoreNodeApi()) {
    return [];
  }

  const normalizedId = String(storeId);
  if (!isMongoObjectId(normalizedId)) {
    return [];
  }

  const response = await apiRequest(API_ENDPOINTS.shopReviews(normalizedId));
  const payload = await parseJson(response, 'fetchShopReviewsFromNode');
  return payload.data?.reviews || [];
}

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

export async function fetchRestaurantsFromNode(type = 'all') {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const query = type && type !== 'all' ? `?type=${encodeURIComponent(type)}` : '';
  const response = await apiRequest(`${API_ENDPOINTS.restaurants}${query}`);
  const data = await parseJson(response, 'fetchRestaurantsFromNode');
  log.ok('fetchRestaurantsFromNode', { type, count: data.restaurants?.length || 0 });
  return data.restaurants || [];
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

export async function fetchStoreFromNode(storeId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const normalizedId = String(storeId);

  if (isMongoObjectId(normalizedId)) {
    const shopResponse = await apiRequest(API_ENDPOINTS.shopById(normalizedId));
    const shopPayload = await parseJson(shopResponse, 'fetchShopFromNode');
    return shopPayload.data?.shop || null;
  }

  const response = await apiRequest(API_ENDPOINTS.restaurant(normalizedId));
  const data = await parseJson(response, 'fetchStoreFromNode');
  return data.store || null;
}

export async function fetchProductsFromNode(storeId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const normalizedId = String(storeId);

  if (isMongoObjectId(normalizedId)) {
    const response = await apiRequest(API_ENDPOINTS.shopProducts(normalizedId));
    const payload = await parseJson(response, 'fetchShopProductsFromNode');
    return payload.data?.products || [];
  }

  const response = await apiRequest(API_ENDPOINTS.restaurantProducts(normalizedId));
  const data = await parseJson(response, 'fetchProductsFromNode');
  return data.products || [];
}

export async function fetchProductFromNode(productId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const response = await apiRequest(API_ENDPOINTS.product(productId));
  const payload = await parseJson(response, 'fetchProductFromNode');
  return payload.data?.product || payload.product || null;
}

export async function fetchReviewsFromNode(storeId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const normalizedId = String(storeId);

  if (isMongoObjectId(normalizedId)) {
    const response = await apiRequest(API_ENDPOINTS.shopReviews(normalizedId));
    const payload = await parseJson(response, 'fetchShopReviewsFromNode');
    return payload.data?.reviews || [];
  }

  const response = await apiRequest(API_ENDPOINTS.restaurantReviews(storeId));
  const data = await parseJson(response, 'fetchReviewsFromNode');
  return data.reviews || [];
}

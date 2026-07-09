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

export async function fetchStoreFromNode(storeId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const response = await apiRequest(API_ENDPOINTS.restaurant(storeId));
  const data = await parseJson(response, 'fetchStoreFromNode');
  return data.store || null;
}

export async function fetchProductsFromNode(storeId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const response = await apiRequest(API_ENDPOINTS.restaurantProducts(storeId));
  const data = await parseJson(response, 'fetchProductsFromNode');
  return data.products || [];
}

export async function fetchProductFromNode(productId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const response = await apiRequest(API_ENDPOINTS.product(productId));
  const data = await parseJson(response, 'fetchProductFromNode');
  return data.product || null;
}

export async function fetchReviewsFromNode(storeId) {
  if (!hasStoreNodeApi()) {
    return null;
  }

  const response = await apiRequest(API_ENDPOINTS.restaurantReviews(storeId));
  const data = await parseJson(response, 'fetchReviewsFromNode');
  return data.reviews || [];
}

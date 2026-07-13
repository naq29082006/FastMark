import { apiRequest, AUTH_TIMEOUT_MS, SELLER_UPLOAD_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';
import { normalizeCategoryId } from '../core/utils/categoryId';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu API thất bại.');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function authHeaders(idToken) {
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

export async function getProductCategoriesOnBackend() {
  const response = await apiRequest(
    API_ENDPOINTS.productCategories,
    { method: 'GET' },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return (payload.data?.categories || []).map((category) => ({
    ...category,
    id: normalizeCategoryId(category.id || category._id),
    name: category.name || category.categoryName || '',
    categoryName: category.name || category.categoryName || '',
    icon: category.icon || '',
    description: category.description || '',
  })).filter((category) => category.id && category.categoryName);
}

export async function getShopCategoriesOnBackend() {
  const response = await apiRequest(
    API_ENDPOINTS.shopCategories,
    { method: 'GET' },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return (payload.data?.categories || []).map((category) => ({
    ...category,
    id: normalizeCategoryId(category.id || category._id),
    name: category.name || category.categoryName || '',
    categoryName: category.name || category.categoryName || '',
    icon: category.icon || '',
    description: category.description || '',
  })).filter((category) => category.id && category.categoryName);
}

export async function getMyProductsOnBackend(idToken) {
  const response = await apiRequest(
    API_ENDPOINTS.products,
    {
      method: 'GET',
      headers: await authHeaders(idToken),
    },
    AUTH_TIMEOUT_MS
  );

  const parsed = await parseApiResponse(response);
  return parsed.data?.products || [];
}

export async function getMyProductOnBackend(idToken, productId) {
  const response = await apiRequest(
    API_ENDPOINTS.myProductById(productId),
    {
      method: 'GET',
      headers: await authHeaders(idToken),
    },
    AUTH_TIMEOUT_MS
  );

  const parsed = await parseApiResponse(response);
  return parsed.data?.product;
}

export async function createProductOnBackend({ idToken, payload }) {
  const response = await apiRequest(
    API_ENDPOINTS.products,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify(payload),
    },
    SELLER_UPLOAD_TIMEOUT_MS
  );

  const parsed = await parseApiResponse(response);
  return parsed.data;
}

export async function updateProductOnBackend({ idToken, productId, payload }) {
  const response = await apiRequest(
    API_ENDPOINTS.productById(productId),
    {
      method: 'PUT',
      headers: await authHeaders(idToken),
      body: JSON.stringify(payload),
    },
    SELLER_UPLOAD_TIMEOUT_MS
  );

  const parsed = await parseApiResponse(response);
  return parsed.data?.product;
}

export async function deleteProductOnBackend(idToken, productId) {
  const response = await apiRequest(
    API_ENDPOINTS.productById(productId),
    {
      method: 'DELETE',
      headers: await authHeaders(idToken),
    },
    AUTH_TIMEOUT_MS
  );

  return parseApiResponse(response);
}

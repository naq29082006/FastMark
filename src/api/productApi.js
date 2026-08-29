import { apiRequest, AUTH_TIMEOUT_MS, SELLER_UPLOAD_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';
import { normalizeCategoryId } from '../core/utils/categoryId';
import { normalizePageResult } from '../core/utils/pagination';

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
    description: category.description || '',
  })).filter((category) => category.id && category.categoryName);
}

export async function discoverProductsOnBackend({
  latitude,
  longitude,
  radiusMeters = 5000,
  categoryId = '',
  search = '',
  page = 1,
  limit = 20,
  seed = '',
}) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radiusMeters),
    page: String(page),
    limit: String(limit),
  });

  const trimmedSearch = String(search || '').trim();
  const trimmedCategoryId = String(categoryId || '').trim();
  if (trimmedSearch) {
    params.set('search', trimmedSearch);
  }
  if (trimmedCategoryId) {
    params.set('categoryId', trimmedCategoryId);
  }
  if (seed) {
    params.set('seed', String(seed));
  }

  const response = await apiRequest(
    `${API_ENDPOINTS.productsDiscover}?${params.toString()}`,
    { method: 'GET' },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return normalizePageResult(payload.data || {}, 'products');
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
    description: category.description || '',
  })).filter((category) => category.id && category.categoryName);
}

export async function getMyProductsOnBackend(idToken, { page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const response = await apiRequest(
    `${API_ENDPOINTS.products}?${params.toString()}`,
    {
      method: 'GET',
      headers: await authHeaders(idToken),
    },
    AUTH_TIMEOUT_MS
  );

  const parsed = await parseApiResponse(response);
  return normalizePageResult(
    {
      ...(parsed.data || {}),
      items: parsed.data?.products || parsed.data?.items || [],
    },
    'items'
  );
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
  return {
    ...(parsed.data || {}),
    message: parsed.message || '',
  };
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

export async function setProductPinOnBackend({ idToken, productId, pinProduct }) {
  const response = await apiRequest(
    API_ENDPOINTS.productPin(productId),
    {
      method: 'PUT',
      headers: await authHeaders(idToken),
      body: JSON.stringify({ pinProduct: Number(pinProduct) || 0 }),
    },
    AUTH_TIMEOUT_MS
  );
  const parsed = await parseApiResponse(response);
  return parsed.data?.product;
}

export async function listPromotionProductsOnBackend({
  page = 1,
  limit = 20,
  latitude,
  longitude,
  seed = '',
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
    params.set('lat', String(latitude));
    params.set('lng', String(longitude));
  }
  if (seed) {
    params.set('seed', String(seed));
  }
  const response = await apiRequest(
    `${API_ENDPOINTS.productsPromotions}?${params.toString()}`,
    { method: 'GET' },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return normalizePageResult(payload.data || {}, 'products');
}

export async function clearProductPromotionOnBackend({ idToken, productId }) {
  const response = await apiRequest(
    API_ENDPOINTS.productPromotion(productId),
    {
      method: 'DELETE',
      headers: await authHeaders(idToken),
    },
    AUTH_TIMEOUT_MS
  );
  const parsed = await parseApiResponse(response);
  return parsed.data?.product;
}

export async function listMyPromotionProductsOnBackend(idToken, { limit = 100 } = {}) {
  const response = await apiRequest(
    `${API_ENDPOINTS.productsPromotionsMine}?limit=${limit}`,
    {
      method: 'GET',
      headers: await authHeaders(idToken),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data?.products || [];
}

/** Giảm giá hàng loạt — cập nhật thẳng Product. */
export async function bulkSetProductPromotionsOnBackend({
  idToken,
  productIds,
  discountPercent,
  promotionStartDate,
  promotionEndDate,
}) {
  const response = await apiRequest(
    API_ENDPOINTS.productsPromotionsBulk,
    {
      method: 'POST',
      headers: await authHeaders(idToken),
      body: JSON.stringify({
        productIds,
        discountPercent,
        promotionStartDate,
        promotionEndDate,
      }),
    },
    AUTH_TIMEOUT_MS
  );
  const payload = await parseApiResponse(response);
  return payload.data || { updatedCount: 0, products: [] };
}

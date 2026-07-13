import { apiRequest } from './client';

function categoryBase(type) {
  return type === 'shops' ? '/api/categories/shops' : '/api/categories/products';
}

export function listCategories(token, type = 'products') {
  return apiRequest(categoryBase(type), { token });
}

export function createCategory(token, type, payload) {
  return apiRequest(categoryBase(type), {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateCategory(token, type, categoryId, payload) {
  return apiRequest(`${categoryBase(type)}/${categoryId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function deleteCategory(token, type, categoryId) {
  return apiRequest(`${categoryBase(type)}/${categoryId}`, {
    method: 'DELETE',
    token,
  });
}

import { apiUrl } from '../config/env';

export async function uploadCategoryIcon(token, type, categoryId, file) {
  const formData = new FormData();
  formData.append('icon', file);

  const response = await fetch(`${apiUrl}${categoryBase(type)}/${categoryId}/icon`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'Upload icon thất bại.');
  }
  return payload;
}

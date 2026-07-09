import { apiRequest } from './client';

export function listCategories(token) {
  return apiRequest('/api/categories', { token });
}

export function createCategory(token, payload) {
  return apiRequest('/api/categories', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateCategory(token, categoryId, payload) {
  return apiRequest(`/api/categories/${categoryId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function deleteCategory(token, categoryId) {
  return apiRequest(`/api/categories/${categoryId}`, {
    method: 'DELETE',
    token,
  });
}

import { fetchProductById, fetchProductsByStoreId } from '../../repository/productRepository';
import { fetchReviewsByStoreId } from '../../repository/reviewRepository';
import { fetchStoreById } from '../../repository/storeRepository';

export async function loadStoreById(storeId) {
  return fetchStoreById(storeId);
}

export async function loadProductsByStoreId(storeId) {
  return fetchProductsByStoreId(storeId);
}

export async function loadProductById(productId) {
  return fetchProductById(productId);
}

export async function loadReviewsByStoreId(storeId) {
  return fetchReviewsByStoreId(storeId);
}

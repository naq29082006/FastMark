import { getMockProductById, getMockProductsByStoreId } from '../model/mock/storeMockData';
import { createLogger } from '../core/utils/logger';
import {
  fetchProductFromFirestore,
  fetchProductsFromFirestore,
} from '../api/productApi';
import {
  getFallbackProductById,
  makeFallbackProducts,
} from '../model/productModel';

const log = createLogger('ProductRepository');

export async function fetchProductsByStoreId(storeId) {
  log.info('fetchProductsByStoreId:start', { storeId });

  try {
    const products = await fetchProductsFromFirestore(storeId);

    if (products.length > 0) {
      log.ok('fetchProductsByStoreId:firestore', { storeId, count: products.length });
      return products;
    }

    log.warn('fetchProductsByStoreId:empty-firestore', { storeId });
  } catch (error) {
    log.fail('fetchProductsByStoreId:firestore-failed', error);
  }

  const mockProducts = getMockProductsByStoreId(storeId);
  if (mockProducts.length > 0) {
    log.info('fetchProductsByStoreId:mock', { storeId, count: mockProducts.length });
    return mockProducts;
  }

  const fallback = makeFallbackProducts(storeId);
  log.info('fetchProductsByStoreId:fallback', { storeId, count: fallback.length });
  return fallback;
}

export async function fetchProductById(productId) {
  log.info('fetchProductById:start', { productId });

  const fallbackProduct = getFallbackProductById(productId);
  if (fallbackProduct) {
    log.ok('fetchProductById:fallback-hit', { productId });
    return fallbackProduct;
  }

  try {
    const product = await fetchProductFromFirestore(productId);
    if (product) {
      return product;
    }

    log.warn('fetchProductById:not-found-firestore', { productId });
  } catch (error) {
    log.fail('fetchProductById:firestore-failed', error);
  }

  const mockProduct = getMockProductById(productId);
  log.info('fetchProductById:mock', { productId, found: Boolean(mockProduct) });
  return mockProduct;
}

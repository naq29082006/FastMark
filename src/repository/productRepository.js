import { getMockProductById, getMockProductsByStoreId } from '../model/mock/storeMockData';
import { createLogger } from '../core/utils/logger';
import {
  fetchProductFromNode,
  fetchProductsFromNode,
  hasStoreNodeApi,
} from '../api/storeNodeApi';
import {
  getFallbackProductById,
  makeFallbackProducts,
  normalizeProduct,
} from '../model/productModel';

const log = createLogger('ProductRepository');

export async function fetchProductsByStoreId(storeId) {
  log.info('fetchProductsByStoreId:start', { storeId });

  if (hasStoreNodeApi()) {
    try {
      const products = await fetchProductsFromNode(storeId);
      if (products.length > 0) {
        log.ok('fetchProductsByStoreId:node-api', { storeId, count: products.length });
        return products.map(normalizeProduct);
      }
      log.warn('fetchProductsByStoreId:node-api-empty', { storeId });
    } catch (error) {
      log.fail('fetchProductsByStoreId:node-api-failed', error);
    }
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

  if (hasStoreNodeApi()) {
    try {
      const product = await fetchProductFromNode(productId);
      if (product) {
        log.ok('fetchProductById:node-api', { productId });
        return normalizeProduct(product);
      }
      log.warn('fetchProductById:node-api-not-found', { productId });
    } catch (error) {
      log.fail('fetchProductById:node-api-failed', error);
    }
  }

  const mockProduct = getMockProductById(productId);
  log.info('fetchProductById:mock', { productId, found: Boolean(mockProduct) });
  return mockProduct;
}

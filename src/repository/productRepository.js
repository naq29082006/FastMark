import { createLogger } from '../core/utils/logger';
import {
  fetchProductFromNode,
  fetchProductsFromNode,
  hasStoreNodeApi,
} from '../api/storeNodeApi';
import { normalizeProduct } from '../model/productModel';

const log = createLogger('ProductRepository');

export async function fetchProductsByStoreId(storeId) {
  log.info('fetchProductsByStoreId:start', { storeId });

  if (!hasStoreNodeApi()) {
    log.warn('fetchProductsByStoreId:no-api', { storeId });
    return [];
  }

  try {
    const products = await fetchProductsFromNode(storeId);
    log.ok('fetchProductsByStoreId:node-api', { storeId, count: products.length });
    return products.map(normalizeProduct);
  } catch (error) {
    log.fail('fetchProductsByStoreId:node-api-failed', error);
    return [];
  }
}

export async function fetchProductById(productId) {
  log.info('fetchProductById:start', { productId });

  if (!hasStoreNodeApi()) {
    log.warn('fetchProductById:no-api', { productId });
    return null;
  }

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

  return null;
}

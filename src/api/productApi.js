import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { createLogger } from '../core/utils/logger';
import { getFirestoreDb } from '../core/config/firestoreDb';
import { normalizeProduct } from '../model/productModel';

const log = createLogger('ProductApi');
const PRODUCTS_COLLECTION = 'products';

export async function fetchProductsFromFirestore(storeId) {
  log.info('fetchProductsFromFirestore:start', { storeId });

  const db = getFirestoreDb();
  const snapshot = await getDocs(
    query(collection(db, PRODUCTS_COLLECTION), where('store_id', '==', String(storeId)))
  );

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs
    .map((docSnap) => normalizeProduct({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export async function fetchProductFromFirestore(productId) {
  log.info('fetchProductFromFirestore:start', { productId });

  const db = getFirestoreDb();
  const snapshot = await getDoc(doc(db, PRODUCTS_COLLECTION, String(productId)));

  if (!snapshot.exists()) {
    log.warn('fetchProductFromFirestore:not-found', { productId });
    return null;
  }

  const product = normalizeProduct({ id: snapshot.id, ...snapshot.data() });
  log.ok('fetchProductFromFirestore:success', { productId, name: product.name });
  return product;
}

import { doc, getDoc } from 'firebase/firestore';

import { createLogger } from '../core/utils/logger';
import { getFirestoreDb } from '../core/config/firestoreDb';
import { normalizeStore } from '../model/storeModel';

const log = createLogger('StoreApi');
const RESTAURANTS_COLLECTION = 'restaurants';

export async function fetchStoreFromFirestore(storeId) {
  const normalizedId = String(storeId);
  log.info('fetchStoreFromFirestore:start', { storeId: normalizedId });

  const db = getFirestoreDb();
  const snapshot = await getDoc(doc(db, RESTAURANTS_COLLECTION, normalizedId));

  if (!snapshot.exists()) {
    log.warn('fetchStoreFromFirestore:not-found', { storeId: normalizedId });
    return null;
  }

  const store = normalizeStore({ id: snapshot.id, ...snapshot.data() });
  log.ok('fetchStoreFromFirestore:success', { storeId: normalizedId, name: store.name });
  return store;
}

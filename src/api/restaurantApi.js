import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { createLogger } from '../core/utils/logger';
import { getFirestoreDb } from '../core/config/firestoreDb';

const log = createLogger('RestaurantApi');
const RESTAURANTS_COLLECTION = 'restaurants';

export async function fetchRestaurantsFromFirestore(type = 'all') {
  log.info('fetchRestaurantsFromFirestore:start', { type });

  const db = getFirestoreDb();
  const restaurantsRef = collection(db, RESTAURANTS_COLLECTION);
  const snapshot =
    type === 'all'
      ? await getDocs(restaurantsRef)
      : await getDocs(query(restaurantsRef, where('type', '==', type)));

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

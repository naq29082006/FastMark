import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { createLogger } from '../core/utils/logger';
import { getFirestoreDb } from '../core/config/firestoreDb';
import { normalizeReview } from '../model/reviewModel';

const log = createLogger('ReviewApi');
const REVIEWS_COLLECTION = 'reviews';

export async function fetchReviewsFromFirestore(storeId) {
  log.info('fetchReviewsFromFirestore:start', { storeId });

  const db = getFirestoreDb();
  const snapshot = await getDocs(
    query(collection(db, REVIEWS_COLLECTION), where('store_id', '==', String(storeId)))
  );

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs
    .map((docSnap) => normalizeReview({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

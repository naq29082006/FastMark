import { AppState } from 'react-native';
import {
  enableNetwork,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
} from 'firebase/firestore';

import { createLogger } from '../utils/logger';
import { ensureFirebaseApp } from './firebaseApp';

const log = createLogger('FirestoreDb');

let dbInstance = null;
let appStateSubscription = null;

function ensureFirestoreDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const app = ensureFirebaseApp();

  try {
    dbInstance = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    log.info('firestore:init', { cache: 'memory' });
  } catch (error) {
    log.debug('firestore:init-fallback-getFirestore', error?.message || error);
    dbInstance = getFirestore(app);
  }

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !dbInstance) {
        return;
      }

      enableNetwork(dbInstance)
        .then(() => log.debug('firestore:network-enabled'))
        .catch((error) => log.debug('firestore:network-enable-skipped', error?.message || error));
    });
  }

  return dbInstance;
}

export function getFirestoreDb() {
  log.debug('getFirestoreDb');
  return ensureFirestoreDb();
}

export function isFirestoreOfflineError(error) {
  const code = error?.code || '';
  const message = error?.message || '';

  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    message.includes('client is offline') ||
    message.includes('Failed to get document because the client is offline')
  );
}

export async function reconnectFirestore() {
  const db = ensureFirestoreDb();

  try {
    await enableNetwork(db);
    log.debug('firestore:reconnected');
    return true;
  } catch (error) {
    log.debug('firestore:reconnect-failed', error?.message || error);
    return false;
  }
}

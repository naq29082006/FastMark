import { getApp, getApps } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
} from 'firebase/auth';

import { createLogger } from '../utils/logger';
import { ensureFirebaseApp } from './firebaseApp';

const log = createLogger('FirebaseAuth');

let authInitLogged = false;

function isAlreadyInitialized(error) {
  return error?.code === 'auth/already-initialized';
}

export function ensureFirebaseAuth() {
  const app = ensureFirebaseApp();
  const appsBefore = getApps().length;

  try {
    const auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });

    if (!authInitLogged) {
      log.step('[AUTH] initializeAuth SUCCESS', {
        firebaseApps: appsBefore,
        appName: getApp().name,
      });
      authInitLogged = true;
    }

    return auth;
  } catch (error) {
    if (isAlreadyInitialized(error)) {
      if (!authInitLogged) {
        log.step('[AUTH] initializeAuth REUSE getAuth()', {
          firebaseApps: getApps().length,
          appName: getApp().name,
        });
        authInitLogged = true;
      }
      return getAuth(app);
    }

    log.fail('[AUTH] initializeAuth FAILED', error);
    throw error;
  }
}

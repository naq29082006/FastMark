import { doc, getDoc, setDoc } from 'firebase/firestore';

import { createLogger } from '../core/utils/logger';
import { getNodeApiUrl } from '../core/config/env';
import {
  getFirestoreDb,
  isFirestoreOfflineError,
  reconnectFirestore,
} from '../core/config/firestoreDb';
import { getCurrentUserIdToken } from './authApi';
import { apiRequest } from './client';
import { API_ENDPOINTS } from './endpoints';

const log = createLogger('ProfileApi');

const PROFILE_COLLECTION = 'profiles';
const NODE_FETCH_TIMEOUT_MS = 3000;

function hasNodeApi() {
  return Boolean(getNodeApiUrl());
}

async function fetchWithTimeout(url, options = {}, timeoutMs = NODE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Node API timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readFirebaseProfile(uid) {
  log.step('[PROFILE] firestore read START', { uid });
  const db = getFirestoreDb();
  const profileRef = doc(db, PROFILE_COLLECTION, uid);

  try {
    const snapshot = await getDoc(profileRef);
    log.step('[PROFILE] firestore read DONE', { uid, exists: snapshot.exists() });
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      throw error;
    }

    log.warn('readFirebaseProfile:offline-retry', { uid });
    await reconnectFirestore();

    const snapshot = await getDoc(profileRef);
    log.step('[PROFILE] firestore read DONE (retry)', { uid, exists: snapshot.exists() });
    return snapshot.exists() ? snapshot.data() : null;
  }
}

export async function saveFirebaseProfile(profile) {
  log.step('[PROFILE] firestore save START', { uid: profile.id });
  const db = getFirestoreDb();
  await setDoc(doc(db, PROFILE_COLLECTION, profile.id), profile, { merge: true });
  log.step('[PROFILE] firestore save SUCCESS', { uid: profile.id });
}

async function getNodeAuthToken() {
  try {
    return await getCurrentUserIdToken();
  } catch (error) {
    log.fail('[PROFILE] getIdToken FAILED', error);
    return null;
  }
}

export async function fetchNodeProfile() {
  if (!hasNodeApi()) {
    return null;
  }

  const token = await getNodeAuthToken();
  if (!token) {
    return null;
  }

  const response = await apiRequest(
    API_ENDPOINTS.profile,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    NODE_FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Node API read profile failed: ${response.status}`);
  }

  const data = await response.json();
  return data.profile || null;
}

export async function saveNodeProfile(profile) {
  if (!hasNodeApi()) {
    return null;
  }

  const token = await getNodeAuthToken();
  if (!token) {
    return null;
  }

  const response = await apiRequest(
    API_ENDPOINTS.profile,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profile }),
    },
    NODE_FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Node API save profile failed: ${response.status}`);
  }

  const data = await response.json();
  return data.profile || null;
}

export function hasProfileNodeApi() {
  return hasNodeApi();
}

export function syncNodeProfileInBackground(profile) {
  if (!hasNodeApi()) {
    return;
  }

  saveNodeProfile(profile).catch((error) => {
    log.fail('syncNodeProfileInBackground', error);
  });
}

export { isFirestoreOfflineError } from '../core/config/firestoreDb';

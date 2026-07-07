import { createLogger } from '../core/utils/logger';
import {
  fetchNodeProfile,
  hasProfileNodeApi,
  isFirestoreOfflineError,
  readFirebaseProfile,
  saveFirebaseProfile,
  syncNodeProfileInBackground,
} from '../api/profileApi';
import { readCachedProfile, writeCachedProfile } from '../api/profileCacheApi';
import { mergeProfile } from '../model/profileModel';

const log = createLogger('ProfileRepository');

export { makeProfileFromAuthUser } from '../model/profileModel';

export async function readUserProfile(authUser) {
  log.info('readUserProfile:start', { uid: authUser.uid });

  const cachedProfile = await readCachedProfile(authUser.uid);
  if (cachedProfile) {
    log.ok('readUserProfile:cache', { uid: authUser.uid });
    return mergeProfile(authUser, cachedProfile, null);
  }

  try {
    const firebaseProfile = await readFirebaseProfile(authUser.uid);
    if (firebaseProfile) {
      const profile = mergeProfile(authUser, firebaseProfile, null);
      await writeCachedProfile(profile);
      log.ok('readUserProfile:firestore', { uid: authUser.uid });
      return profile;
    }
    log.warn('readUserProfile:firestore-empty', { uid: authUser.uid });
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      log.warn('readUserProfile:firestore-offline', {
        uid: authUser.uid,
        message: error?.message || 'offline',
      });
    } else {
      log.fail('readUserProfile:firestore-failed', error);
    }
  }

  if (hasProfileNodeApi()) {
    try {
      const nodeProfile = await fetchNodeProfile();
      if (nodeProfile) {
        log.ok('readUserProfile:node-api', { uid: authUser.uid });
        return mergeProfile(authUser, nodeProfile, null);
      }
      log.warn('readUserProfile:node-api-empty', { uid: authUser.uid });
    } catch (error) {
      log.fail('readUserProfile:node-api-failed', error);
    }
  }

  log.info('readUserProfile:default-profile', { uid: authUser.uid });
  return mergeProfile(authUser, null, null);
}

export async function upsertUserProfile(authUser, updates = {}, options = {}) {
  log.info('upsertUserProfile:start', { uid: authUser.uid, updates: Object.keys(updates || {}) });
  const { existingProfile = null } = options;

  let currentProfile = existingProfile;
  if (!currentProfile) {
    currentProfile = await readUserProfile(authUser).catch(() => null);
  }

  const profile = mergeProfile(authUser, currentProfile, updates);

  try {
    await saveFirebaseProfile(profile);
    await writeCachedProfile(profile);
    log.ok('upsertUserProfile:firestore-saved', { uid: authUser.uid });
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      log.warn('upsertUserProfile:firestore-offline', {
        uid: authUser.uid,
        message: error?.message || 'offline',
      });
      await writeCachedProfile(profile);
    } else {
      log.fail('upsertUserProfile:firestore-failed', error);
    }
  }

  syncNodeProfileInBackground(profile);

  return profile;
}

export { writeCachedProfile, readCachedProfile } from '../api/profileCacheApi';

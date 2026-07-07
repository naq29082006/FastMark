import { createLogger } from '../core/utils/logger';
import {
  fetchNodeProfile,
  hasProfileNodeApi,
  saveNodeProfile,
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

  if (hasProfileNodeApi()) {
    try {
      const nodeProfile = await fetchNodeProfile();
      if (nodeProfile) {
        const profile = mergeProfile(authUser, nodeProfile, null);
        await writeCachedProfile(profile);
        log.ok('readUserProfile:node-api', { uid: authUser.uid });
        return profile;
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
  await writeCachedProfile(profile);

  if (hasProfileNodeApi()) {
    try {
      const saved = await saveNodeProfile(profile);
      if (saved) {
        await writeCachedProfile(saved);
        log.ok('upsertUserProfile:node-api-saved', { uid: authUser.uid });
        return saved;
      }
    } catch (error) {
      log.fail('upsertUserProfile:node-api-failed', error);
    }
  }

  log.ok('upsertUserProfile:local-cache', { uid: authUser.uid });
  return profile;
}

export { writeCachedProfile, readCachedProfile } from '../api/profileCacheApi';

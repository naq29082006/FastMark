import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger } from '../core/utils/logger';

const log = createLogger('ProfileCacheApi');

function cacheKey(uid) {
  return `fastmark:profile:${uid}`;
}

export async function readCachedProfile(uid) {
  if (!uid) {
    return null;
  }

  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    const profile = raw ? JSON.parse(raw) : null;
    log.debug('readCachedProfile', { uid, hit: Boolean(profile) });
    return profile;
  } catch (error) {
    log.fail('readCachedProfile', error);
    return null;
  }
}

export async function writeCachedProfile(profile) {
  if (!profile?.id) {
    return;
  }

  try {
    await AsyncStorage.setItem(cacheKey(profile.id), JSON.stringify(profile));
    log.debug('writeCachedProfile', { uid: profile.id });
  } catch (error) {
    log.fail('writeCachedProfile', error);
  }
}

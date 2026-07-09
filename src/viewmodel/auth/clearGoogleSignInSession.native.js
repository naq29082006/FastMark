import { googleLogger as log } from '../../core/utils/logger';
import { getNativeGoogleSignInModule } from './googleSignInModule';

export async function clearGoogleSignInSession() {
  const nativeModule = getNativeGoogleSignInModule();

  if (!nativeModule?.GoogleSignin) {
    return;
  }

  try {
    await nativeModule.GoogleSignin.signOut();
    log.info('googleSession:cleared');
  } catch (error) {
    log.debug('googleSession:clear-skipped', error?.message || error);
  }
}

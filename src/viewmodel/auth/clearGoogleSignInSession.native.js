import { googleLogger as log } from '../../core/utils/logger';

function getGoogleSignin() {
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin/lib/module/signIn/GoogleSignin');
    return GoogleSignin;
  } catch (error) {
    log.debug('googleSession:module-unavailable', error?.message || error);
    return null;
  }
}

export async function clearGoogleSignInSession() {
  const GoogleSignin = getGoogleSignin();

  if (!GoogleSignin) {
    return;
  }

  try {
    await GoogleSignin.signOut();
    log.info('googleSession:cleared');
  } catch (error) {
    log.debug('googleSession:clear-skipped', error?.message || error);
  }
}

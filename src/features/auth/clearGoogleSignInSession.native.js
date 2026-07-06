import { GoogleSignin } from '@react-native-google-signin/google-signin/lib/module/signIn/GoogleSignin';

import { googleLogger as log } from '../../utils/logger';

export async function clearGoogleSignInSession() {
  try {
    await GoogleSignin.signOut();
    log.info('googleSession:cleared');
  } catch (error) {
    log.debug('googleSession:clear-skipped', error?.message || error);
  }
}

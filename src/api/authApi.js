import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';

import { createLogger } from '../core/utils/logger';
import { ensureFirebaseAuth } from '../core/config/firebaseAuth';
import { getResolvedFirebaseConfigSummary } from '../core/config/firebaseApp';
import { serializeAuthUser } from '../model/authModel';

const log = createLogger('AuthApi');

export function getCurrentFirebaseUser() {
  return ensureFirebaseAuth().currentUser;
}

export function subscribeToAuthChanges(onChange, onError) {
  log.step('[AUTH] onAuthStateChanged SUBSCRIBE');
  return onAuthStateChanged(
    ensureFirebaseAuth(),
    (user) => {
      log.step('[AUTH] onAuthStateChanged EVENT', {
        uid: user?.uid || null,
        email: user?.email || null,
      });
      onChange(user);
    },
    (error) => {
      log.fail('[AUTH] onAuthStateChanged ERROR', error);
      onError?.(error);
    }
  );
}

export async function registerWithEmail({ email, password, fullName, photoUrl }) {
  log.step('[AUTH] createUser START', { email });
  const auth = ensureFirebaseAuth();

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

  log.step('[AUTH] createUser SUCCESS', { uid: credential.user.uid });

  log.step('[AUTH] updateProfile START', { uid: credential.user.uid });
  try {
    await updateProfile(credential.user, {
      displayName: fullName?.trim() || null,
      photoURL: photoUrl?.trim() || null,
    });
    log.step('[AUTH] updateProfile SUCCESS', { uid: credential.user.uid });
  } catch (error) {
    log.fail('[AUTH] updateProfile FAILED (non-fatal — user already created)', error);
  }

  return serializeAuthUser(credential.user);
}

export async function loginWithEmail({ email, password }) {
  log.step('[AUTH] signInWithEmail START', { email });
  const credential = await signInWithEmailAndPassword(
    ensureFirebaseAuth(),
    email.trim(),
    password
  );

  log.step('[AUTH] signInWithEmail SUCCESS', { uid: credential.user.uid });
  return serializeAuthUser(credential.user);
}

export async function logoutCurrentUser() {
  log.step('[AUTH] signOut START');
  await signOut(ensureFirebaseAuth());
  log.step('[AUTH] signOut SUCCESS');
}

export async function updateCurrentUserProfile({ fullName, photoUrl }) {
  const user = getCurrentFirebaseUser();

  if (!user) {
    log.warn('[AUTH] updateCurrentUserProfile:no-user');
    throw new Error('Bạn cần đăng nhập lại.');
  }

  log.step('[AUTH] updateCurrentUserProfile START', { uid: user.uid });
  await updateProfile(user, {
    displayName: fullName?.trim() || null,
    photoURL: photoUrl?.trim() || null,
  });
  log.step('[AUTH] updateCurrentUserProfile SUCCESS', { uid: user.uid });

  return serializeAuthUser(user);
}

export async function changeCurrentUserPassword({ currentPassword, newPassword }) {
  const user = getCurrentFirebaseUser();

  if (!user?.email) {
    log.warn('[AUTH] changeCurrentUserPassword:no-user');
    throw new Error('Bạn cần đăng nhập lại.');
  }

  log.step('[AUTH] changePassword START', { uid: user.uid });
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
  log.step('[AUTH] changePassword SUCCESS', { uid: user.uid });
}

export async function getCurrentUserIdToken(forceRefresh = false) {
  const user = getCurrentFirebaseUser();

  if (!user) {
    return null;
  }

  return user.getIdToken(forceRefresh);
}

export async function signInWithGoogleCredential(idToken) {
  log.step('[AUTH] signInWithGoogleCredential START', getResolvedFirebaseConfigSummary());

  if (!idToken) {
    throw new Error('Thiếu id_token từ Google.');
  }

  const auth = ensureFirebaseAuth();
  const credential = GoogleAuthProvider.credential(idToken);

  try {
    const result = await signInWithCredential(auth, credential);
    log.step('[AUTH] signInWithGoogleCredential SUCCESS', { uid: result.user.uid });
    return serializeAuthUser(result.user);
  } catch (error) {
    log.fail('[AUTH] signInWithGoogleCredential FAILED', {
      code: error?.code || '(no-code)',
      message: error?.message || '(no-message)',
      config: getResolvedFirebaseConfigSummary(),
    });
    throw error;
  }
}

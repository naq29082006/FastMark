import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithCustomToken,
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
const TOKEN_STORAGE_KEY = 'fastmark:firebase-id-token';

/** Giống code cũ: không timeout ngắn. Chỉ fail-safe rất dài để app không treo vô hạn. */
const TOKEN_HARD_TIMEOUT_MS = 45000;

let cachedIdToken = null;
let cachedTokenUid = null;
let cachedTokenExpiresAtMs = 0;
let inflightTokenPromise = null;
let lastTokenWarnAt = 0;

function decodeJwtExpiryMs(token) {
  try {
    const payloadPart = String(token || '').split('.')[1];
    if (!payloadPart) {
      return 0;
    }
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decode =
      typeof globalThis.atob === 'function'
        ? globalThis.atob
        : (value) => Buffer.from(value, 'base64').toString('utf8');
    const payload = JSON.parse(decode(padded));
    return (Number(payload.exp) || 0) * 1000;
  } catch {
    return 0;
  }
}

function rememberIdToken(uid, token) {
  cachedIdToken = token;
  cachedTokenUid = uid;
  const expiry = decodeJwtExpiryMs(token);
  cachedTokenExpiresAtMs = expiry > 0 ? expiry - 2 * 60 * 1000 : Date.now() + 45 * 60 * 1000;
  AsyncStorage.setItem(
    TOKEN_STORAGE_KEY,
    JSON.stringify({
      uid,
      token,
      expiresAtMs: cachedTokenExpiresAtMs,
    })
  ).catch(() => {});
}

async function readPersistedIdToken(uid) {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.token || parsed.uid !== uid) {
      return null;
    }
    if (Number(parsed.expiresAtMs) <= Date.now()) {
      return null;
    }
    cachedIdToken = parsed.token;
    cachedTokenUid = uid;
    cachedTokenExpiresAtMs = Number(parsed.expiresAtMs);
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearCachedIdToken() {
  cachedIdToken = null;
  cachedTokenUid = null;
  cachedTokenExpiresAtMs = 0;
  inflightTokenPromise = null;
  AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
}

/** Seed cache from backend login idToken — tránh chờ Firebase getIdToken thêm lần nữa. */
export function cacheIdToken(uid, token) {
  if (!uid || !token) {
    return;
  }
  rememberIdToken(uid, token);
}

export async function waitForAuthReady(timeoutMs = 12000) {
  const auth = ensureFirebaseAuth();
  if (typeof auth.authStateReady !== 'function') {
    return auth.currentUser || null;
  }

  try {
    await Promise.race([
      auth.authStateReady(),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch (error) {
    log.warn('[AUTH] authStateReady failed', error?.message || error);
  }

  return auth.currentUser || null;
}

export function getCurrentFirebaseUser() {
  return ensureFirebaseAuth().currentUser;
}

async function waitAuthReady() {
  const auth = ensureFirebaseAuth();
  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  }
}

export function subscribeToAuthChanges(onChange, onError) {
  log.step('[AUTH] onAuthStateChanged SUBSCRIBE');
  return onAuthStateChanged(
    ensureFirebaseAuth(),
    (user) => {
      // Chỉ xóa cache khi logout thật — không xóa khi Firebase còn đang restore session.
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

  try {
    const token = await credential.user.getIdToken(false);
    if (token) {
      rememberIdToken(credential.user.uid, token);
    }
  } catch {
    // Non-fatal: token sẽ lấy sau.
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

  try {
    const token = await credential.user.getIdToken(false);
    if (token) {
      rememberIdToken(credential.user.uid, token);
    }
  } catch {
    // Non-fatal.
  }

  return serializeAuthUser(credential.user);
}

export async function logoutCurrentUser() {
  log.step('[AUTH] signOut START');
  clearCachedIdToken();
  await signOut(ensureFirebaseAuth());
  log.step('[AUTH] signOut SUCCESS');
}

export async function updateCurrentUserProfile({ fullName, photoUrl } = {}) {
  const user = getCurrentFirebaseUser();

  if (!user) {
    log.warn('[AUTH] updateCurrentUserProfile:no-user');
    throw new Error('Bạn cần đăng nhập lại.');
  }

  const updates = {};
  if (fullName !== undefined) {
    updates.displayName = fullName?.trim() || null;
  }
  if (photoUrl !== undefined) {
    updates.photoURL = photoUrl?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return serializeAuthUser(user);
  }

  log.step('[AUTH] updateCurrentUserProfile START', { uid: user.uid });
  await updateProfile(user, updates);
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

/**
 * Lấy Firebase ID token — hành vi gần code cũ (`user.getIdToken`),
 * thêm: đợi auth ready, cache, single-flight (tránh spam khi nhiều màn gọi cùng lúc).
 *
 * Lưu ý: forceRefresh=true luôn gọi Google (chậm/dễ fail nếu mạng kém) — chỉ dùng khi retry 401.
 */
export async function getCurrentUserIdToken(forceRefresh = false) {
  await waitAuthReady();

  const user = getCurrentFirebaseUser();
  if (!user) {
    // Không xóa AsyncStorage token ở đây — tránh race lúc app vừa mở (auth chưa restore).
    return null;
  }

  const now = Date.now();
  if (
    !forceRefresh &&
    cachedIdToken &&
    cachedTokenUid === user.uid &&
    cachedTokenExpiresAtMs > now
  ) {
    return cachedIdToken;
  }

  if (!forceRefresh && !cachedIdToken) {
    const persisted = await readPersistedIdToken(user.uid);
    if (persisted) {
      return persisted;
    }
  }

  if (!forceRefresh && inflightTokenPromise) {
    return inflightTokenPromise;
  }

  const request = (async () => {
    try {
      // Giống code cũ: chờ Firebase trả token thật (không race 6s).
      const tokenPromise = user.getIdToken(forceRefresh);
      const token = await Promise.race([
        tokenPromise,
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('TOKEN_HARD_TIMEOUT'));
          }, TOKEN_HARD_TIMEOUT_MS);
        }),
      ]);

      if (token) {
        rememberIdToken(user.uid, token);
      }
      return token || null;
    } catch (error) {
      const persisted = await readPersistedIdToken(user.uid);
      if (persisted) {
        if (Date.now() - lastTokenWarnAt > 15000) {
          lastTokenWarnAt = Date.now();
          log.warn('[AUTH] getIdToken chậm — dùng token đã lưu');
        }
        return persisted;
      }

      if (Date.now() - lastTokenWarnAt > 15000) {
        lastTokenWarnAt = Date.now();
        log.warn(
          '[AUTH] getIdToken chưa sẵn sàng',
          error?.message === 'TOKEN_HARD_TIMEOUT'
            ? 'Firebase refresh token quá lâu (mạng → Google). Thử lại sau hoặc đăng nhập lại.'
            : error?.message || String(error)
        );
      }
      return null;
    } finally {
      if (inflightTokenPromise === request) {
        inflightTokenPromise = null;
      }
    }
  })();

  if (!forceRefresh) {
    inflightTokenPromise = request;
  }

  return request;
}

export async function signInWithCustomTokenFromBackend(customToken) {
  log.step('[AUTH] signInWithCustomToken START');
  const auth = ensureFirebaseAuth();
  const result = await signInWithCustomToken(auth, customToken);
  log.step('[AUTH] signInWithCustomToken SUCCESS', { uid: result.user.uid });

  try {
    const token = await result.user.getIdToken(false);
    if (token) {
      rememberIdToken(result.user.uid, token);
    }
  } catch {
    // Non-fatal.
  }

  return serializeAuthUser(result.user);
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

    try {
      const token = await result.user.getIdToken(false);
      if (token) {
        rememberIdToken(result.user.uid, token);
      }
    } catch {
      // Non-fatal.
    }

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

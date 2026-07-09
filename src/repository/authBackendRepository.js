import {
  confirmEmailVerificationOnBackend,
  getMeOnBackend,
  loginGoogleOnBackend,
  loginOnBackend,
  registerEmailOnBackend,
  requestEmailVerificationOnBackend,
} from '../api/authBackendApi';

export async function registerAccount(payload) {
  return registerEmailOnBackend(payload);
}

export async function loginAccount(payload) {
  const result = await loginOnBackend(payload);
  return result.data;
}

export async function syncGoogleAccount(payload) {
  return loginGoogleOnBackend(payload);
}

export async function fetchBackendUser(idToken) {
  return getMeOnBackend(idToken);
}

export async function requestEmailVerification(idToken) {
  return requestEmailVerificationOnBackend(idToken);
}

export async function confirmEmailVerification({ idToken, code }) {
  return confirmEmailVerificationOnBackend({ idToken, code });
}

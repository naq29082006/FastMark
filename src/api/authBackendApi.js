import { apiRequest, AUTH_TIMEOUT_MS, hasApiBaseUrl } from './client';
import { API_ENDPOINTS } from './endpoints';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu API thất bại.');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export function ensureBackendApiConfigured() {
  if (!hasApiBaseUrl()) {
    throw new Error('Chưa cấu hình EXPO_PUBLIC_NODE_API_URL trong .env');
  }
}

export async function registerEmailOnBackend({ email, password, userName, fullName }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(
    API_ENDPOINTS.authRegisterEmail,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        userName,
        fullName,
      }),
    },
    AUTH_TIMEOUT_MS
  );

  return parseApiResponse(response);
}

export async function loginOnBackend({ login, password }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(
    API_ENDPOINTS.authLoginEmail,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    },
    AUTH_TIMEOUT_MS
  );

  return parseApiResponse(response);
}

export async function loginGoogleOnBackend({ idToken, userName, fullName }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(
    API_ENDPOINTS.authGoogle,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        userName,
        fullName,
      }),
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function getMeOnBackend(idToken) {
  ensureBackendApiConfigured();

  const response = await apiRequest(API_ENDPOINTS.authMe, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function requestEmailVerificationOnBackend(idToken) {
  ensureBackendApiConfigured();

  const response = await apiRequest(API_ENDPOINTS.authVerifyEmailRequest, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function confirmEmailVerificationOnBackend({ idToken, code }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(API_ENDPOINTS.authVerifyEmailConfirm, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function updateProfileOnBackend({ idToken, fullName, phone }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(
    API_ENDPOINTS.authUpdateMe,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName, phone }),
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function uploadAvatarOnBackend({ idToken, imageBase64, mimeType = 'image/jpeg' }) {
  ensureBackendApiConfigured();

  if (!imageBase64) {
    throw new Error('Thiếu dữ liệu ảnh để upload.');
  }

  const response = await apiRequest(
    API_ENDPOINTS.authUploadAvatar,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
      }),
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data;
}

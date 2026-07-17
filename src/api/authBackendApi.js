import { apiRequest, AUTH_TIMEOUT_MS, hasApiBaseUrl } from './client';
import { API_ENDPOINTS } from './endpoints';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu API thất bại.');
    error.statusCode = response.status;
    error.code = payload.code || '';
    error.field = payload.field || '';
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

export async function checkRegisterAvailabilityOnBackend({ userName, email }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(
    API_ENDPOINTS.authRegisterAvailability,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, email }),
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data || {};
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

export async function requestEmailVerificationOnBackend(idToken, { isResend = false } = {}) {
  ensureBackendApiConfigured();

  const response = await apiRequest(API_ENDPOINTS.authVerifyEmailRequest, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isResend }),
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

export async function updateProfileOnBackend({ idToken, fullName, userName }) {
  ensureBackendApiConfigured();

  const body = {};
  if (fullName !== undefined) {
    body.fullName = fullName;
  }
  if (userName !== undefined) {
    body.userName = userName;
  }

  const response = await apiRequest(
    API_ENDPOINTS.authUpdateMe,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

export async function requestPasswordResetOnBackend({ email }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(
    API_ENDPOINTS.authForgotPasswordRequest,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    },
    AUTH_TIMEOUT_MS
  );

  return parseApiResponse(response);
}

export async function verifyPasswordResetOtpOnBackend({ email, code }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(
    API_ENDPOINTS.authForgotPasswordVerify,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data;
}

export async function resetPasswordOnBackend({ email, resetToken, newPassword }) {
  ensureBackendApiConfigured();

  const response = await apiRequest(
    API_ENDPOINTS.authForgotPasswordReset,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, resetToken, newPassword }),
    },
    AUTH_TIMEOUT_MS
  );

  return parseApiResponse(response);
}

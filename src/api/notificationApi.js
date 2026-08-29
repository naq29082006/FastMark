import { apiRequest, AUTH_TIMEOUT_MS } from './client';
import { callWithAuthToken } from './authTokenHelper';
import { API_ENDPOINTS } from './endpoints';
import { DEFAULT_PAGE_SIZE, normalizePageResult } from '../core/utils/pagination';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu API thất bại.');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

function toAudienceQuery(audience, { page, limit, tab } = {}) {
  const params = new URLSearchParams();
  const value = String(audience || 'buyer').trim().toLowerCase();
  if (value === 'seller' || value === 'system') {
    params.set('audience', value);
  } else {
    params.set('audience', 'buyer');
  }
  const tabKey = String(tab || 'all').trim().toLowerCase();
  if (tabKey === 'order' || tabKey === 'system') {
    params.set('tab', tabKey);
  }
  if (page != null) {
    params.set('page', String(page));
  }
  if (limit != null) {
    params.set('limit', String(limit));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getMyNotificationsOnBackend(
  audience = 'buyer',
  { page = 1, limit = DEFAULT_PAGE_SIZE, tab = 'all' } = {}
) {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      `${API_ENDPOINTS.notifications}${toAudienceQuery(audience, { page, limit, tab })}`,
      { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    const data = payload.data || {};
    return {
      ...normalizePageResult(
        {
          ...data,
          ...(data.pagination || {}),
          items: data.items || [],
        },
        'items'
      ),
      // Số chưa đọc do backend đếm trên toàn bộ audience, không phải chỉ trang hiện tại.
      unreadCount: Math.max(0, Number(data.unreadCount) || 0),
    };
  });
}

export async function getUnreadNotificationCountOnBackend(audience = 'buyer') {
  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      `${API_ENDPOINTS.notificationsUnreadCount}${toAudienceOnlyQuery(audience)}`,
      { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return Math.max(0, Number(payload.data?.unreadCount) || 0);
  });
}

function toAudienceOnlyQuery(audience) {
  const value = String(audience || 'buyer').trim().toLowerCase();
  if (value === 'seller' || value === 'system') {
    return `?audience=${encodeURIComponent(value)}`;
  }
  return '?audience=buyer';
}

export async function markAllNotificationsReadOnBackend(audience = 'buyer') {
  const normalizedAudience = String(audience || 'buyer').trim().toLowerCase();

  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      `${API_ENDPOINTS.notificationsReadAll}${toAudienceOnlyQuery(normalizedAudience)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audience: normalizedAudience }),
      },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data || {};
  });
}

export async function markNotificationReadOnBackend(notificationId, audience = 'buyer') {
  const id = encodeURIComponent(String(notificationId || '').trim());
  if (!id) {
    throw new Error('Thiếu mã thông báo.');
  }

  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      `${API_ENDPOINTS.notificationRead(id)}${toAudienceOnlyQuery(audience)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audience }),
      },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data?.notification;
  });
}

export async function registerDevicePushTokenOnBackend({ token, platform }) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('Thiếu device token.');
  }

  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.notificationDeviceToken,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: normalizedToken,
          platform: String(platform || 'unknown'),
        }),
      },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data;
  });
}

export async function removeDevicePushTokenOnBackend(token) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return { removed: 0 };
  }

  return callWithAuthToken(async (idToken) => {
    const response = await apiRequest(
      API_ENDPOINTS.notificationDeviceToken,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: normalizedToken }),
      },
      AUTH_TIMEOUT_MS
    );
    const payload = await parseApiResponse(response);
    return payload.data;
  });
}

import { apiRequest, getApiBaseUrl, hasApiBaseUrl } from './client';
import { API_ENDPOINTS } from './endpoints';

export async function fetchApiHealth() {
  if (!hasApiBaseUrl()) {
    return {
      configured: false,
      online: false,
      statusCode: null,
      latencyMs: null,
      message: 'Chưa cấu hình EXPO_PUBLIC_NODE_API_URL',
      baseUrl: '',
    };
  }

  const startedAt = Date.now();
  const response = await apiRequest(API_ENDPOINTS.root, { method: 'GET' });
  const message = await response.text();

  return {
    configured: true,
    online: response.ok,
    statusCode: response.status,
    latencyMs: Date.now() - startedAt,
    message: message.trim() || '(empty response)',
    baseUrl: getApiBaseUrl(),
  };
}

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
  const contentType = response.headers.get('content-type') || '';
  let message = '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    message = data.service || data.ok ? 'Fastmark API online' : JSON.stringify(data);
  } else {
    message = (await response.text()).trim() || '(empty response)';
  }

  return {
    configured: true,
    online: response.ok,
    statusCode: response.status,
    latencyMs: Date.now() - startedAt,
    message,
    baseUrl: getApiBaseUrl(),
  };
}

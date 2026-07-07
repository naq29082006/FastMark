import { getNodeApiUrl } from '../core/config/env';
import { createLogger } from '../core/utils/logger';

const log = createLogger('ApiClient');

const DEFAULT_TIMEOUT_MS = 8000;

export function getApiBaseUrl() {
  return getNodeApiUrl().replace(/\/$/, '');
}

export function hasApiBaseUrl() {
  return Boolean(getApiBaseUrl());
}

export async function apiRequest(path, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    throw new Error('Chưa cấu hình EXPO_PUBLIC_NODE_API_URL trong .env');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    log.debug('request', options.method || 'GET', url);
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('API timeout — máy chủ không phản hồi kịp thời.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

import { getNodeApiUrl } from '../core/config/env';
import { createLogger } from '../core/utils/logger';

const log = createLogger('ApiClient');

const DEFAULT_TIMEOUT_MS = 8000;
const AUTH_TIMEOUT_MS = 45000;
const SELLER_UPLOAD_TIMEOUT_MS = 120000;

function toReadableNetworkError(error, url) {
  const message = String(error?.message || error || '');

  if (
    error?.name === 'AbortError' ||
    /cancell?ed/i.test(message)
  ) {
    return new Error(
      `Kết nối backend quá thời gian chờ hoặc bị hủy (${url}). Kiểm tra backend đang chạy (cd backend && npm run dev) và EXPO_PUBLIC_NODE_API_URL trỏ đúng IP máy tính trên cùng Wi-Fi (hiện tại trong .env).`
    );
  }

  if (
    message.includes('NoRouteToHost') ||
    message.includes('Host unreachable') ||
    message.includes('Network request failed') ||
    message.includes('Failed to connect')
  ) {
    return new Error(
      `Không kết nối được backend (${url}). Kiểm tra backend đang chạy (cd backend && npm run dev) và EXPO_PUBLIC_NODE_API_URL khớp PORT trong backend/.env (hiện tại thường là :5000). Emulator Android: http://10.0.2.2:<port>.`
    );
  }

  return error;
}

export { AUTH_TIMEOUT_MS, SELLER_UPLOAD_TIMEOUT_MS };

export function getApiBaseUrl() {
  return getNodeApiUrl();
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
    throw toReadableNetworkError(error, url);
  } finally {
    clearTimeout(timeoutId);
  }
}

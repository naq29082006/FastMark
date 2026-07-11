import { apiUrl } from '../config/env';

export function resolveMediaUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('//')) {
    return `https:${normalized}`;
  }

  const base = String(apiUrl || '').replace(/\/$/, '');
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return base ? `${base}${path}` : normalized;
}

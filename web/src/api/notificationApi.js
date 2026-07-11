import { apiRequest } from './client';

export function sendSystemNotification(token, { title, content, audience }) {
  return apiRequest('/api/admin/notifications/broadcast', {
    method: 'POST',
    token,
    body: { title, content, audience },
  });
}

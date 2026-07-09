import { apiRequest } from './client';

export async function loginAccount({ login, password }) {
  const payload = await apiRequest('/api/auth/login/email', {
    method: 'POST',
    body: { login, password },
  });

  return payload.data;
}

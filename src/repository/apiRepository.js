import { getApiBaseUrl, hasApiBaseUrl } from '../api/client';
import { fetchApiHealth } from '../api/healthApi';
import { getStartupDiagnostics } from '../core/utils/authDiagnostics';

export function getApiConfig() {
  const baseUrl = getApiBaseUrl();

  return {
    baseUrl: baseUrl || '',
    configured: hasApiBaseUrl(),
    displayUrl: baseUrl || '(chưa cấu hình)',
  };
}

export async function loadApiOverview() {
  return {
    config: getApiConfig(),
    diagnostics: getStartupDiagnostics(),
  };
}

export async function testApiConnection() {
  return fetchApiHealth();
}

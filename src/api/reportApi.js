import { apiRequest, AUTH_TIMEOUT_MS } from './client';
import { API_ENDPOINTS } from './endpoints';

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu API thất bại.');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export async function submitReportOnBackend({
  idToken,
  reportType,
  shopId,
  shopName,
  productId,
  productName,
  title,
  content,
}) {
  const response = await apiRequest(
    API_ENDPOINTS.buyerReports,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reportType,
        shopId,
        shopName,
        productId,
        productName,
        title,
        content,
      }),
    },
    AUTH_TIMEOUT_MS
  );

  const payload = await parseApiResponse(response);
  return payload.data?.report;
}

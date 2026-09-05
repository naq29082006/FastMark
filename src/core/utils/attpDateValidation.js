import { formatDateString, parseDateString } from './dateFormat';

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function parseAttpDateValue(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  if (!/^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(text)) {
    return null;
  }

  const parsed = parseDateString(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const normalized = formatDateString(parsed);
  const roundTrip = parseDateString(normalized);
  if (Number.isNaN(roundTrip.getTime()) || formatDateString(roundTrip) !== normalized) {
    return null;
  }

  return roundTrip;
}

export function validateAttpDates(issuedAtRaw, expiresAtRaw) {
  const issuedText = String(issuedAtRaw || '').trim();
  const expiresText = String(expiresAtRaw || '').trim();

  if (!issuedText) {
    return { ok: false, error: 'Vui lòng nhập ngày cấp giấy phép.' };
  }
  if (!expiresText) {
    return { ok: false, error: 'Vui lòng nhập ngày hết hạn giấy phép.' };
  }

  const issuedDate = parseAttpDateValue(issuedText);
  if (!issuedDate) {
    return { ok: false, error: 'Ngày cấp không hợp lệ. Vui lòng chọn từ lịch.' };
  }

  const expiresDate = parseAttpDateValue(expiresText);
  if (!expiresDate) {
    return { ok: false, error: 'Ngày hết hạn không hợp lệ. Vui lòng chọn từ lịch.' };
  }

  if (expiresDate.getTime() < issuedDate.getTime()) {
    return { ok: false, error: 'Ngày hết hạn phải sau hoặc bằng ngày cấp.' };
  }

  const todayEnd = endOfDay(new Date());
  if (issuedDate.getTime() > todayEnd.getTime()) {
    return { ok: false, error: 'Ngày cấp không được ở tương lai.' };
  }

  const todayStart = startOfDay(new Date());
  if (expiresDate.getTime() < todayStart.getTime()) {
    return { ok: false, error: 'Giấy phép đã hết hạn. Vui lòng kiểm tra ngày trên giấy tờ.' };
  }

  return {
    ok: true,
    issuedAt: formatDateString(issuedDate),
    expiresAt: formatDateString(expiresDate),
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@fastmark/resume_reservation';
const TTL_MS = 30 * 60 * 1000;

/**
 * Lưu ngữ cảnh giữ hàng trước khi sang nạp ví,
 * để Back hoặc nạp xong mở lại đúng màn Yêu cầu giữ hàng + form.
 */
export function buildReservationResumePayload({
  productId,
  variantId = null,
  quantity = 1,
  source = 'products',
  storeId = null,
  dateInput = '',
  timeInput = '',
  note = '',
}) {
  return {
    productId: String(productId),
    variantId: variantId ? String(variantId) : null,
    quantity: Math.max(1, Number(quantity) || 1),
    source: source || 'products',
    storeId: storeId ? String(storeId) : null,
    dateInput: String(dateInput || ''),
    timeInput: String(timeInput || ''),
    note: String(note || ''),
    fromTopUp: true,
    savedAt: Date.now(),
  };
}

export async function saveReservationResume(payload) {
  if (!payload?.productId) {
    return;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(buildReservationResumePayload(payload)));
}

export async function loadReservationResume() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.productId) {
      return null;
    }
    if (Date.now() - Number(parsed.savedAt || 0) > TTL_MS) {
      await clearReservationResume();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearReservationResume() {
  await AsyncStorage.removeItem(KEY);
}

export function toReservationFormResume(payload) {
  if (!payload?.fromTopUp) {
    return null;
  }
  return {
    fromTopUp: true,
    variantId: payload.variantId || null,
    quantity: Math.max(1, Number(payload.quantity) || 1),
    dateInput: payload.dateInput || '',
    timeInput: payload.timeInput || '',
    note: payload.note || '',
  };
}

export function toResumeReserveRequest(payload) {
  if (!payload?.productId) {
    return null;
  }
  return {
    productId: String(payload.productId),
    variantId: payload.variantId || null,
    quantity: Number(payload.quantity) || 1,
    storeId: payload.storeId || null,
    source: payload.source || 'products',
    dateInput: payload.dateInput || '',
    timeInput: payload.timeInput || '',
    note: payload.note || '',
    fromTopUp: Boolean(payload.fromTopUp),
    at: Date.now(),
  };
}

/** Giá trị filter “Tất cả” — không gửi lên API. */
export const ALL_FILTER_VALUE = 'all';

export const ALL_FILTER_OPTION = { value: ALL_FILTER_VALUE, label: 'Tất cả' };

export function withAllFilterOption(options = []) {
  return [ALL_FILTER_OPTION, ...options];
}

/** Map giá trị UI → tham số API (bỏ qua “Tất cả”). */
export function apiFilterParam(value) {
  if (value === undefined || value === null || value === '' || value === ALL_FILTER_VALUE) {
    return undefined;
  }
  return value;
}

/** Giá trị khởi tạo filter từ URL hoặc mặc định “Tất cả”. */
export function initialFilterValue(urlValue, fallback = ALL_FILTER_VALUE) {
  if (urlValue === undefined || urlValue === null || urlValue === '') {
    return fallback;
  }
  return urlValue;
}

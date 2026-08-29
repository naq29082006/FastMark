/**
 * Chuẩn hóa chuỗi tìm kiếm toàn app: bỏ dấu tiếng Việt + lowercase + trim.
 * Dùng thống nhất cho mọi ô tìm kiếm (client filter và so khớp haystack).
 */
export function removeVietnameseDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Alias theo spec Search Service. */
export function removeVietnameseTones(value) {
  return removeVietnameseDiacritics(value);
}

export function normalizeSearchText(value) {
  return removeVietnameseDiacritics(String(value || ''))
    .trim()
    .toLowerCase();
}

export function normalizeSearchKeyword(value) {
  return normalizeSearchText(value).replace(/^@+/, '').replace(/^#+/, '');
}

export function tokenizeSearchQuery(keyword) {
  return normalizeSearchKeyword(keyword).split(/\s+/).filter(Boolean);
}

/**
 * Mọi token phải xuất hiện trong haystack (substring, thứ tự token không bắt buộc).
 */
export function matchesTokenSearch(haystack, keyword) {
  const tokens = tokenizeSearchQuery(keyword);
  if (tokens.length === 0) {
    return true;
  }
  const normalizedHay = normalizeSearchText(haystack);
  if (!normalizedHay) {
    return false;
  }
  return tokens.every((token) => normalizedHay.includes(token));
}

export function matchesTokenSearchAny(fields, keyword) {
  const combined = (fields || [])
    .map((field) => String(field || '').trim())
    .filter(Boolean)
    .join(' ');
  return matchesTokenSearch(combined, keyword);
}

/** Mọi token phải khớp trong cùng một field (tránh ghép chữ giữa các field). */
export function matchesTokenSearchInAnyField(fields, keyword) {
  const tokens = tokenizeSearchQuery(keyword);
  if (tokens.length === 0) {
    return true;
  }
  const normalizedFields = (fields || [])
    .map((field) => normalizeSearchText(field))
    .filter(Boolean);
  if (!normalizedFields.length) {
    return false;
  }
  return normalizedFields.some((field) =>
    tokens.every((token) => field.includes(token))
  );
}

/** Điểm cao hơn = khớp tốt hơn (prefix, full phrase, token positions). */
export function rankSearchMatch(haystack, keyword) {
  const normHay = normalizeSearchText(haystack);
  const normKey = normalizeSearchKeyword(keyword);
  if (!normKey) {
    return 0;
  }
  if (!matchesTokenSearch(normHay, normKey)) {
    return -1;
  }
  if (normHay === normKey) {
    return 1000;
  }
  if (normHay.startsWith(normKey)) {
    return 900;
  }
  const tokens = tokenizeSearchQuery(normKey);
  if (tokens.length === 1 && normHay.includes(tokens[0])) {
    const index = normHay.indexOf(tokens[0]);
    return 700 - Math.min(index, 200);
  }
  if (tokens.length > 1) {
    const indexSum = tokens.reduce((sum, token) => {
      const index = normHay.indexOf(token);
      return sum + (index >= 0 ? index : 999);
    }, 0);
    return 650 - Math.min(indexSum, 400);
  }
  return normHay.includes(normKey) ? 500 : 400;
}

export function rankSearchMatchAny(fields, keyword) {
  const scores = (fields || []).map((field) => rankSearchMatch(field, keyword));
  return Math.max(-1, ...scores);
}

/**
 * true nếu haystack chứa keyword sau khi normalize (contains, không phân biệt hoa/thường/dấu).
 * keyword rỗng → luôn khớp.
 */
export function matchesSearch(haystack, keyword) {
  const needle = normalizeSearchText(keyword);
  if (!needle) {
    return true;
  }
  return normalizeSearchText(haystack).includes(needle);
}

/**
 * true nếu bất kỳ field nào khớp keyword.
 */
export function matchesSearchAny(fields, keyword) {
  return matchesTokenSearchAny(fields, keyword);
}

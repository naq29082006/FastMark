export function removeVietnameseDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function removeVietnameseTones(value) {
  return removeVietnameseDiacritics(value);
}

export function normalizeSearchText(value) {
  return removeVietnameseDiacritics(value).trim().toLowerCase();
}

export function normalizeSearchKeyword(value) {
  return normalizeSearchText(value).replace(/^@+/, '').replace(/^#+/, '');
}

export function tokenizeSearchQuery(keyword) {
  return normalizeSearchKeyword(keyword).split(/\s+/).filter(Boolean);
}

export function matchesTokenSearch(haystack, keyword) {
  const tokens = tokenizeSearchQuery(keyword);
  if (!tokens.length) {
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

export function matchesSearchText(haystack, needle) {
  return matchesTokenSearch(haystack, needle);
}

export function resolveStatusesFromLabelSearch(keyword, entries = []) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized || normalized.length < 2) {
    return [];
  }

  const matched = new Set();
  for (const entry of entries) {
    const labelNorm = normalizeSearchText(entry.label);
    if (!labelNorm) {
      continue;
    }
    if (matchesTokenSearch(labelNorm, normalized)) {
      const statuses = Array.isArray(entry.statuses)
        ? entry.statuses
        : entry.status !== undefined
          ? [entry.status]
          : [];
      statuses.forEach((status) => {
        if (Number.isFinite(Number(status))) {
          matched.add(Number(status));
        }
      });
    }
  }

  return [...matched];
}

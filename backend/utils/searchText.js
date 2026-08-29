const {
  MIN_SEARCH_LENGTH,
  removeVietnameseTones,
  normalizeSearchText,
  normalizeSearchKeyword,
  tokenizeSearchQuery,
  matchesTokenSearch,
  matchesTokenSearchAny,
  rankSearchMatch,
  rankSearchMatchAny,
  buildSearchRegex,
  buildMongoTokenFieldFilter,
  filterAndRankItems,
  escapeRegex,
} = require("./searchService");

function buildDocumentIdContainsCondition(keyword, fieldName = "_id") {
  const normalized = normalizeSearchKeyword(keyword).replace(/^id:\s*/, "");
  const needle = normalized.replace(/[^a-z0-9]/gi, "");
  if (!needle || needle.length < MIN_SEARCH_LENGTH) {
    return null;
  }

  return {
    $expr: {
      $regexMatch: {
        input: { $toString: `$${fieldName}` },
        regex: escapeRegex(needle),
        options: "i",
      },
    },
  };
}

function buildNumberFieldContainsCondition(fieldName, keyword) {
  const digits = String(keyword || "").replace(/\D/g, "");
  if (!digits || digits.length < MIN_SEARCH_LENGTH) {
    return null;
  }

  return {
    $expr: {
      $regexMatch: {
        input: { $toString: `$${fieldName}` },
        regex: escapeRegex(digits),
        options: "i",
      },
    },
  };
}

function buildStatusLabelEntries(statusLabelMap = {}) {
  return Object.entries(statusLabelMap).map(([code, label]) => ({
    label: String(label || ""),
    statuses: [Number(code)],
  }));
}

function resolveStatusesFromLabelSearch(keyword, entries = []) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized || normalized.length < MIN_SEARCH_LENGTH) {
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

function appendUniqueOrConditions(target, conditions = []) {
  const next = conditions.filter(Boolean);
  if (!next.length) {
    return target;
  }
  if (!target.$or) {
    target.$or = [];
  }
  target.$or.push(...next);
  return target;
}

module.exports = {
  MIN_SEARCH_LENGTH,
  removeVietnameseTones,
  normalizeSearchText,
  normalizeSearchKeyword,
  tokenizeSearchQuery,
  matchesTokenSearch,
  matchesTokenSearchAny,
  rankSearchMatch,
  rankSearchMatchAny,
  buildSearchRegex,
  buildMongoTokenFieldFilter,
  filterAndRankItems,
  buildDocumentIdContainsCondition,
  buildNumberFieldContainsCondition,
  buildStatusLabelEntries,
  resolveStatusesFromLabelSearch,
  appendUniqueOrConditions,
  escapeRegex,
};

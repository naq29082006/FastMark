const { removeVietnameseDiacritics } = require("./sanitizeFileName");

const MIN_SEARCH_LENGTH = 2;
const MIN_TOKEN_LENGTH = 1;

const LETTER_CLASSES = {
  a: "aàáạảãâầấậẩẫăằắặẳẵ",
  e: "eèéẹẻẽêềếệểễ",
  i: "iìíịỉĩ",
  o: "oòóọỏõôồốộổỗơờớợởỡ",
  u: "uùúụủũưừứựửữ",
  y: "yỳýỵỷỹ",
  d: "dđ",
};

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeVietnameseTones(value) {
  return removeVietnameseDiacritics(String(value || ""));
}

function normalizeSearchText(value) {
  return removeVietnameseTones(String(value || "")).trim().toLowerCase();
}

function normalizeSearchKeyword(value) {
  return normalizeSearchText(value).replace(/^@+/, "").replace(/^#+/, "");
}

function tokenizeSearchQuery(keyword) {
  return normalizeSearchKeyword(keyword).split(/\s+/).filter(Boolean);
}

function matchesTokenSearch(haystack, keyword) {
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

function matchesTokenSearchAny(fields, keyword) {
  const combined = (fields || [])
    .map((field) => String(field || "").trim())
    .filter(Boolean)
    .join(" ");
  return matchesTokenSearch(combined, keyword);
}

/** Mọi token phải khớp trong cùng một field (tránh ghép chữ giữa các field). */
function matchesTokenSearchInAnyField(fields, keyword) {
  const tokens = tokenizeSearchQuery(keyword);
  if (!tokens.length) {
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

function rankSearchMatch(haystack, keyword) {
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

function rankSearchMatchAny(fields, keyword) {
  const scores = (fields || []).map((field) => rankSearchMatch(field, keyword));
  return Math.max(-1, ...scores);
}

function buildSearchRegex(keyword, { minLength = MIN_SEARCH_LENGTH } = {}) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized || normalized.length < minLength) {
    return null;
  }

  let pattern = "";
  for (const char of normalized) {
    const variants = LETTER_CLASSES[char];
    if (variants) {
      pattern += `[${variants}${variants.toUpperCase()}]`;
    } else {
      pattern += escapeRegex(char);
    }
  }

  return new RegExp(pattern, "i");
}

/** Mongo: mỗi token phải khớp ít nhất một field (AND token, OR field). */
function buildMongoTokenFieldFilter(keyword, fieldNames = [], { minTokenLength = MIN_TOKEN_LENGTH } = {}) {
  const tokens = tokenizeSearchQuery(keyword);
  if (!tokens.length || !fieldNames.length) {
    return null;
  }

  const andParts = tokens
    .map((token) => {
      const regex = buildSearchRegex(token, { minLength: minTokenLength });
      if (!regex) {
        return null;
      }
      return {
        $or: fieldNames.map((field) => ({ [field]: regex })),
      };
    })
    .filter(Boolean);

  if (!andParts.length) {
    return null;
  }
  if (andParts.length === 1) {
    return andParts[0];
  }
  return { $and: andParts };
}

function filterAndRankItems(items, getFields, keyword) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized) {
    return items || [];
  }

  return (items || [])
    .map((item) => ({
      item,
      rank: rankSearchMatchAny(getFields(item), normalized),
    }))
    .filter((row) => row.rank >= 0)
    .sort(
      (left, right) =>
        right.rank - left.rank ||
        String(left.item?.id || left.item?._id || "").localeCompare(
          String(right.item?.id || right.item?._id || "")
        )
    )
    .map((row) => row.item);
}

module.exports = {
  MIN_SEARCH_LENGTH,
  MIN_TOKEN_LENGTH,
  removeVietnameseTones,
  normalizeSearchText,
  normalizeSearchKeyword,
  tokenizeSearchQuery,
  matchesTokenSearch,
  matchesTokenSearchAny,
  matchesTokenSearchInAnyField,
  rankSearchMatch,
  rankSearchMatchAny,
  buildSearchRegex,
  buildMongoTokenFieldFilter,
  filterAndRankItems,
  escapeRegex,
  LETTER_CLASSES,
};

const mongoose = require("mongoose");
const {
  buildSearchRegex,
  buildDocumentIdContainsCondition,
  buildNumberFieldContainsCondition,
  buildStatusLabelEntries,
  resolveStatusesFromLabelSearch,
  appendUniqueOrConditions,
  normalizeSearchKeyword,
  normalizeSearchText,
  matchesTokenSearch,
  buildMongoTokenFieldFilter,
} = require("./searchText");

const DEFAULT_USER_SEARCH_FIELDS = ["FullName", "UserName", "Email", "Phone"];

async function findUsersBySearchRegex(User, regex, fields = DEFAULT_USER_SEARCH_FIELDS) {
  if (!regex || !User) {
    return [];
  }

  return User.find({
    $or: fields.map((field) => ({ [field]: regex })),
  })
    .select("_id")
    .lean();
}

async function findUsersByTokenSearch(User, keyword, fields = DEFAULT_USER_SEARCH_FIELDS) {
  if (!User) {
    return [];
  }
  const tokenFilter = buildMongoTokenFieldFilter(keyword, fields, { minTokenLength: 1 });
  if (!tokenFilter) {
    return [];
  }
  return User.find(tokenFilter).select("_id").lean();
}

function buildObjectIdSearchConditions(search) {
  const normalized = String(search || "")
    .trim()
    .replace(/^#+/, "")
    .replace(/^ID:\s*/i, "");

  if (!normalized || normalized.length < 2) {
    return [];
  }

  const fullId = normalized.replace(/[^a-f0-9]/gi, "");
  if (/^[0-9a-f]{24}$/i.test(fullId) && mongoose.Types.ObjectId.isValid(fullId)) {
    return [{ _id: new mongoose.Types.ObjectId(fullId) }];
  }

  const idContains = buildDocumentIdContainsCondition(search);
  return idContains ? [idContains] : [];
}

function appendStatusLabelSearchConditions(
  orConditions,
  search,
  statusLabelMap,
  extraEntries = [],
  statusField = "status"
) {
  const matchedStatuses = resolveStatusesFromLabelSearch(search, [
    ...buildStatusLabelEntries(statusLabelMap),
    ...extraEntries,
  ]);
  if (matchedStatuses.length) {
    orConditions.push({ [statusField]: { $in: matchedStatuses } });
  }
  return orConditions;
}

function appendNumericFieldSearchConditions(orConditions, fieldName, search) {
  const condition = buildNumberFieldContainsCondition(fieldName, search);
  if (condition) {
    orConditions.push(condition);
  }
  return orConditions;
}

function matchesNormalizedSearch(haystack, needle) {
  return matchesTokenSearch(haystack, needle);
}

module.exports = {
  DEFAULT_USER_SEARCH_FIELDS,
  findUsersBySearchRegex,
  findUsersByTokenSearch,
  buildObjectIdSearchConditions,
  appendStatusLabelSearchConditions,
  appendNumericFieldSearchConditions,
  buildSearchRegex,
  buildDocumentIdContainsCondition,
  buildStatusLabelEntries,
  resolveStatusesFromLabelSearch,
  appendUniqueOrConditions,
  matchesNormalizedSearch,
};

const Reservation = require("../models/Reservation");
const { parsePagination, buildPaginationMeta } = require("./pagination");
const {
  normalizeSearchKeyword,
  matchesTokenSearchInAnyField,
  rankSearchMatchAny,
  MIN_SEARCH_LENGTH,
} = require("./searchService");

/** Mã đơn hiển thị (8 ký tự cuối) — không dùng full ObjectId để tránh khớp nhầm substring. */
function shortOrderIdDisplay(item) {
  const id = String(item?.id || item?._id || "").trim();
  if (!id) {
    return "";
  }
  const compact = id.replace(/[^a-zA-Z0-9]/g, "");
  return (compact.length >= 8 ? compact.slice(-8) : compact).toUpperCase();
}

function buildBuyerReservationSearchFields(item) {
  return [item?.orderCode, shortOrderIdDisplay(item), item?.product?.productName];
}

function buildSellerReservationSearchFields(item) {
  return [item?.orderCode, shortOrderIdDisplay(item), item?.product?.productName];
}

function reservationMatchesSearch(item, keyword, role = "buyer") {
  const fields =
    role === "seller"
      ? buildSellerReservationSearchFields(item)
      : buildBuyerReservationSearchFields(item);
  return matchesTokenSearchInAnyField(fields, keyword);
}

function reservationSearchRank(item, keyword, role = "buyer") {
  const fields =
    role === "seller"
      ? buildSellerReservationSearchFields(item)
      : buildBuyerReservationSearchFields(item);
  return rankSearchMatchAny(fields, keyword);
}

const MAX_IN_MEMORY_SEARCH = 3000;

/**
 * Phân trang đơn; khi có search → quét tab (giới hạn MAX), lọc token + xếp hạng, rồi slice trang.
 */
async function listReservationsWithSearch({
  reservationQuery,
  tab,
  search,
  page,
  limit,
  mapReservation,
  searchRole = "buyer",
}) {
  const keyword = normalizeSearchKeyword(search);
  const { page: safePage, limit: safeLimit, skip } = parsePagination({ page, limit });
  const { reservationListSortForTab, compareReservationsNewestFirst } = require("./reservationListSort");
  const sort = reservationListSortForTab(tab);

  const searchActive = Boolean(keyword && keyword.length >= MIN_SEARCH_LENGTH);

  if (!searchActive) {
    const total = await Reservation.countDocuments(reservationQuery);
    const reservations = await Reservation.find(reservationQuery)
      .sort(sort)
      .skip(skip)
      .limit(safeLimit);
    const items = await Promise.all(reservations.map((doc) => mapReservation(doc)));
    return {
      reservations: items,
      ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
    };
  }

  const allDocs = await Reservation.find(reservationQuery).sort(sort).limit(MAX_IN_MEMORY_SEARCH);
  const mapped = await Promise.all(allDocs.map((doc) => mapReservation(doc)));

  const filtered = mapped
    .filter((item) => reservationMatchesSearch(item, keyword, searchRole))
    .sort((left, right) => {
      const rankDiff =
        reservationSearchRank(right, keyword, searchRole) -
        reservationSearchRank(left, keyword, searchRole);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return compareReservationsNewestFirst(left, right, tab);
    });

  const total = filtered.length;
  const pageItems = filtered.slice(skip, skip + safeLimit);

  return {
    reservations: pageItems,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

module.exports = {
  buildBuyerReservationSearchFields,
  buildSellerReservationSearchFields,
  reservationMatchesSearch,
  listReservationsWithSearch,
};

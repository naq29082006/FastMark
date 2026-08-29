import {
  matchesTokenSearchInAnyField,
  normalizeSearchKeyword,
} from './searchText';

export const ORDER_SEARCH_MIN_LENGTH = 2;

function shortOrderIdDisplay(item) {
  const id = String(item?.id || item?._id || '').trim();
  if (!id) {
    return '';
  }
  const compact = id.replace(/[^a-zA-Z0-9]/g, '');
  return (compact.length >= 8 ? compact.slice(-8) : compact).toUpperCase();
}

export function buildBuyerOrderSearchFields(item) {
  return [item?.orderCode, shortOrderIdDisplay(item), item?.product?.productName];
}

export function buildSellerOrderSearchFields(item) {
  return [item?.orderCode, shortOrderIdDisplay(item), item?.product?.productName];
}

export function normalizeOrderSearchKeyword(keyword) {
  return normalizeSearchKeyword(keyword);
}

export function isOrderSearchActive(keyword) {
  const normalized = normalizeOrderSearchKeyword(keyword);
  return normalized.length >= ORDER_SEARCH_MIN_LENGTH;
}

export function orderMatchesSearch(item, keyword, role = 'buyer') {
  const normalized = normalizeOrderSearchKeyword(keyword);
  if (!normalized || normalized.length < ORDER_SEARCH_MIN_LENGTH) {
    return true;
  }
  const fields =
    role === 'seller' ? buildSellerOrderSearchFields(item) : buildBuyerOrderSearchFields(item);
  return matchesTokenSearchInAnyField(fields, normalized);
}

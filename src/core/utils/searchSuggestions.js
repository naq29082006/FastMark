import { normalizeSearchKeyword, rankSearchMatchAny, matchesTokenSearchAny } from './searchText';

export const SEARCH_SUGGESTION_LIMIT = 7;
export const SEARCH_SUGGEST_MIN_LENGTH = 2;

function rankProducts(products, keyword) {
  return (products || [])
    .map((product) => ({
      product,
      rank: rankSearchMatchAny(
        [product.name, product.productName, product.storeName, product.shopName],
        keyword
      ),
    }))
    .filter((row) => row.rank >= 0)
    .sort((left, right) => right.rank - left.rank || String(left.product.id).localeCompare(String(right.product.id)))
    .map((row) => row.product);
}

function rankShops(shops, keyword) {
  return (shops || [])
    .map((shop) => ({
      shop,
      rank: rankSearchMatchAny(
        [
          shop.shop_name,
          shop.name,
          shop.shop_username,
          shop.shopUsername,
          shop.category_name,
        ],
        keyword
      ),
    }))
    .filter((row) => row.rank >= 0)
    .sort((left, right) => right.rank - left.rank || String(left.shop.id).localeCompare(String(right.shop.id)))
    .map((row) => row.shop);
}

function rankUsers(users, keyword) {
  return (users || [])
    .map((user) => ({
      user,
      rank: rankSearchMatchAny(
        [user.fullName, user.displayName, user.userName, user.username],
        keyword
      ),
    }))
    .filter((row) => row.rank >= 0)
    .sort((left, right) => right.rank - left.rank || String(left.user.id).localeCompare(String(right.user.id)))
    .map((row) => row.user);
}

/**
 * Gộp gợi ý: ưu tiên sản phẩm → gian hàng → người dùng, tối đa `limit` (mặc định 7).
 */
export function buildSearchSuggestions({
  products = [],
  shops = [],
  users = [],
  keyword = '',
  limit = SEARCH_SUGGESTION_LIMIT,
} = {}) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized || normalized.length < SEARCH_SUGGEST_MIN_LENGTH) {
    return [];
  }

  const rankedProducts = rankProducts(products, normalized);
  const rankedShops = rankShops(shops, normalized);
  const rankedUsers = rankUsers(users, normalized);

  const picked = [];
  const takeFrom = (type, rows, mapItem) => {
    for (const row of rows) {
      if (picked.length >= limit) {
        break;
      }
      picked.push(mapItem(row));
    }
  };

  takeFrom('product', rankedProducts, (product) => ({
    id: `product-${product.id}`,
    type: 'product',
    data: product,
  }));
  takeFrom('shop', rankedShops, (shop) => ({
    id: `shop-${shop.id}`,
    type: 'shop',
    data: shop,
  }));
  takeFrom('user', rankedUsers, (user) => ({
    id: `user-${user.id || user.userId || user._id}`,
    type: 'user',
    data: user,
  }));

  return picked;
}

/** Lọc lại kết quả API khi backend chưa token-search (client-side safety net). */
export function filterSuggestionCandidates({ products, shops, users, keyword }) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized) {
    return { products: [], shops: [], users: [] };
  }

  return {
    products: (products || []).filter((product) =>
      matchesTokenSearchAny(
        [product.name, product.productName, product.storeName, product.shopName],
        normalized
      )
    ),
    shops: (shops || []).filter((shop) =>
      matchesTokenSearchAny(
        [shop.shop_name, shop.name, shop.shop_username, shop.shopUsername],
        normalized
      )
    ),
    users: (users || []).filter((user) =>
      matchesTokenSearchAny(
        [user.fullName, user.displayName, user.userName, user.username],
        normalized
      )
    ),
  };
}

export function groupSuggestionsByType(items) {
  const products = [];
  const shops = [];
  const users = [];
  (items || []).forEach((item) => {
    if (item.type === 'product') {
      products.push(item);
    } else if (item.type === 'shop') {
      shops.push(item);
    } else if (item.type === 'user') {
      users.push(item);
    }
  });
  return { products, shops, users };
}

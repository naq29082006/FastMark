import {
  fetchNearbyRegisteredShops,
  fetchMapNearbyShops,
} from '../../repository/nearbyShopRepository';
import { searchAddresses, reverseGeocode } from '../../repository/geocodingRepository';

const MAP_MARKER_FETCH_LIMIT = 500;

export async function loadNearbyRegisteredShops({
  latitude,
  longitude,
  radiusMeters,
  shopCategoryId = '',
  page = 1,
  limit = 20,
  seed = '',
}) {
  return fetchNearbyRegisteredShops({
    latitude,
    longitude,
    radiusMeters,
    shopCategoryId,
    page,
    limit,
    seed,
  });
}

/** Load shops in scan radius for map markers (single optimized API call). */
export async function loadAllNearbyShopsForMap({
  latitude,
  longitude,
  radiusMeters,
  shopCategoryId = '',
  limit = MAP_MARKER_FETCH_LIMIT,
}) {
  return fetchMapNearbyShops({
    latitude,
    longitude,
    radiusMeters,
    shopCategoryId,
    limit,
  });
}

export async function searchMapAddresses(query, options) {
  return searchAddresses(query, options);
}

export async function reverseGeocodeLocation(latitude, longitude) {
  return reverseGeocode(latitude, longitude);
}

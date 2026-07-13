import { fetchNearbyRegisteredShops } from '../../repository/nearbyShopRepository';
import { searchAddresses, reverseGeocode } from '../../repository/geocodingRepository';

export async function loadNearbyRegisteredShops({
  latitude,
  longitude,
  radiusMeters,
  shopCategoryId = '',
}) {
  return fetchNearbyRegisteredShops({
    latitude,
    longitude,
    radiusMeters,
    shopCategoryId,
  });
}

export async function searchMapAddresses(query, options) {
  return searchAddresses(query, options);
}

export async function reverseGeocodeLocation(latitude, longitude) {
  return reverseGeocode(latitude, longitude);
}

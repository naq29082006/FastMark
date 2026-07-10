import { fetchRestaurants } from '../../repository/restaurantRepository';
import { fetchNearbyRegisteredShops } from '../../repository/nearbyShopRepository';
import { searchAddresses, reverseGeocode } from '../../repository/geocodingRepository';

export async function loadRestaurants(type = 'all') {
  return fetchRestaurants(type);
}

export async function loadNearbyRegisteredShops({ latitude, longitude, radiusMeters }) {
  return fetchNearbyRegisteredShops({ latitude, longitude, radiusMeters });
}

export async function searchMapAddresses(query, options) {
  return searchAddresses(query, options);
}

export async function reverseGeocodeLocation(latitude, longitude) {
  return reverseGeocode(latitude, longitude);
}

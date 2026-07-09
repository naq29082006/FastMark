import { searchAddressesRemote, reverseGeocodeRemote } from '../api/geocodingApi';

export async function searchAddresses(query, options = {}) {
  return searchAddressesRemote(query, options);
}

export async function reverseGeocode(latitude, longitude) {
  return reverseGeocodeRemote(latitude, longitude);
}

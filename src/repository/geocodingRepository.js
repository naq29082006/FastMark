import { searchAddressesRemote } from '../api/geocodingApi';

export async function searchAddresses(query, options = {}) {
  return searchAddressesRemote(query, options);
}

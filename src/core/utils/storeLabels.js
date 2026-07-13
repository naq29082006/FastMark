const STORE_TYPE_EMOJI = {
  cafe: '☕',
  food: '🍜',
  milktea: '🧋',
  snack: '🍿',
  shop: '🏪',
};

export function getStoreTypeEmoji(type) {
  return STORE_TYPE_EMOJI[type] || '🏪';
}

/**
 * Short order code shown on buyer order list/detail.
 * Uses last 8 chars of Mongo ObjectId for a stable, readable mã đơn.
 */
export function formatOrderCode(id) {
  const raw = String(id || '').trim();
  if (!raw) {
    return 'ID: —';
  }
  const compact = raw.replace(/[^a-zA-Z0-9]/g, '');
  const short = (compact.length >= 8 ? compact.slice(-8) : compact).toUpperCase();
  return `ID: ${short}`;
}

export function getOrderCodeValue(id) {
  return formatOrderCode(id).replace(/^ID:\s*/, '');
}

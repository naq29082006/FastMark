export const ROUTING_PROFILE = {
  CAR: 'car',
  MOTORBIKE: 'motorbike',
};

export const ROUTING_PROFILE_LABELS = {
  [ROUTING_PROFILE.CAR]: 'Ô tô',
  [ROUTING_PROFILE.MOTORBIKE]: 'Xe máy',
};

/** Tốc độ trung bình đô thị (km/h) — ước lượng ETA khi chưa có lộ trình OSRM. */
export const ROUTING_PROFILE_SPEED_KMH = {
  [ROUTING_PROFILE.CAR]: 28,
  [ROUTING_PROFILE.MOTORBIKE]: 38,
};

export function normalizeRoutingProfile(value) {
  return String(value || '').toLowerCase() === ROUTING_PROFILE.CAR
    ? ROUTING_PROFILE.CAR
    : ROUTING_PROFILE.MOTORBIKE;
}

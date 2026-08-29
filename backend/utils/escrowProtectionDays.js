const {
  DEFAULT_ESCROW_PROTECTION_DAYS,
  ESCROW_PROTECTION_DAYS_MIN,
  ESCROW_PROTECTION_DAYS_MAX,
} = require("../constants");

function normalizeEscrowProtectionDays(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ESCROW_PROTECTION_DAYS;
  }
  return Math.min(
    ESCROW_PROTECTION_DAYS_MAX,
    Math.max(ESCROW_PROTECTION_DAYS_MIN, Math.round(parsed))
  );
}

function escrowProtectionMs(days) {
  return normalizeEscrowProtectionDays(days) * 24 * 60 * 60 * 1000;
}

module.exports = {
  normalizeEscrowProtectionDays,
  escrowProtectionMs,
};

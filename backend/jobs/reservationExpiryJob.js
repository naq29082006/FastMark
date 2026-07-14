const reservationService = require("../services/reservationService");

const DEFAULT_INTERVAL_MS = 60 * 1000;

function startReservationExpiryJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const run = async () => {
    try {
      const result = await reservationService.expireOverdueReservations();
      if (result.cancelledCount > 0) {
        console.log(
          `[reservation-expiry] cancelled ${result.cancelledCount} overdue reservation(s)`
        );
      }
    } catch (error) {
      console.error("[reservation-expiry] job failed:", error.message);
    }
  };

  // Initial sweep shortly after boot (wait for Mongo)
  setTimeout(run, 5000);
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

module.exports = {
  startReservationExpiryJob,
};

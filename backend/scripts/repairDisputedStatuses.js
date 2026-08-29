/* One-shot: repair disputed orders wrongly marked completed. */
require("../config/env");
const mongoose = require("mongoose");
const { mongoUri } = require("../config/env");
const { processReservationLifecycle } = require("../services/reservationService");
const Reservation = require("../models/Reservation");
const { RESERVATION_STATUS } = require("../constants");

async function main() {
  await mongoose.connect(mongoUri);
  const result = await processReservationLifecycle();
  const stillMislabeled = await Reservation.countDocuments({
    status: { $in: [3, 5] },
    $or: [{ disputeByBuyer: true }, { disputeBySeller: true }],
  });
  const disputeCancelled = await Reservation.countDocuments({
    status: RESERVATION_STATUS.DISPUTED,
    cocChuyenDen: { $in: [1, 2] },
    $or: [{ disputeByBuyer: true }, { disputeBySeller: true }],
  });
  console.log(JSON.stringify({ result, stillMislabeled, disputeCancelled }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

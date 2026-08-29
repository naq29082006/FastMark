const { DISPUTE_STATUS, RESERVATION_STATUS, DEPOSIT_SETTLE_TO } = require("../constants");
const ReservationDispute = require("../models/ReservationDispute");
const Reservation = require("../models/Reservation");
const {
  buildBothPartiesPendingDisputeFilter,
  buildBothPartiesResolvedDisputeFilter,
} = require("./disputePartyComplaint");
const {
  canAdminResolvePostDeliveryDispute,
  isPostDeliveryDispute,
} = require("./postDeliveryDispute");

function uniqueObjectIds(ids) {
  const seen = new Set();
  const result = [];
  for (const id of ids || []) {
    const key = String(id);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(id);
  }
  return result;
}

async function findPostDeliveryPendingDisputeReservationIds(now = new Date()) {
  const candidates = await ReservationDispute.find({
    status: DISPUTE_STATUS.PENDING,
    $or: [
      { disputeKind: "post_delivery" },
      {
        maLyDoBuyer: { $gt: 0 },
        $or: [
          { maLyDoShop: { $lte: 0 } },
          { maLyDoShop: null },
          { maLyDoShop: { $exists: false } },
        ],
      },
    ],
  })
    .select("reservationId")
    .lean();

  if (!candidates.length) {
    return [];
  }

  const reservationIds = uniqueObjectIds(candidates.map((row) => row.reservationId));
  const reservations = await Reservation.find({ _id: { $in: reservationIds } }).lean();
  const reservationById = new Map(reservations.map((row) => [String(row._id), row]));

  const readyIds = [];
  for (const dispute of candidates) {
    const reservation = reservationById.get(String(dispute.reservationId));
    if (!reservation || !isPostDeliveryDispute(dispute, reservation)) {
      continue;
    }
    if (canAdminResolvePostDeliveryDispute(dispute, now)) {
      readyIds.push(dispute.reservationId);
    }
  }

  return uniqueObjectIds(readyIds);
}

/** Chỉ giữ đơn đang tranh chấp và cọc chưa giải ngân — khớp tab dispute_admin. */
async function filterActiveAdminDisputeReservationIds(reservationIds) {
  const uniqueIds = uniqueObjectIds(reservationIds);
  if (!uniqueIds.length) {
    return [];
  }

  const rows = await Reservation.find({
    _id: { $in: uniqueIds },
    status: RESERVATION_STATUS.DISPUTED,
    $or: [
      { cocChuyenDen: { $exists: false } },
      { cocChuyenDen: null },
      { cocChuyenDen: DEPOSIT_SETTLE_TO.NONE },
      { cocChuyenDen: 0 },
    ],
  })
    .select("_id")
    .lean();

  return rows.map((row) => row._id);
}

/** Đơn tranh chấp chờ admin: pickup (cả hai báo cáo) + post-delivery (seller đã phản hồi / hết hạn). */
async function collectAdminPendingDisputeReservationIds(now = new Date()) {
  const [bothPartyIds, postDeliveryIds] = await Promise.all([
    ReservationDispute.find(buildBothPartiesPendingDisputeFilter()).distinct("reservationId"),
    findPostDeliveryPendingDisputeReservationIds(now),
  ]);

  return filterActiveAdminDisputeReservationIds([...bothPartyIds, ...postDeliveryIds]);
}

async function countAdminPendingDisputes(now = new Date()) {
  const reservationIds = await collectAdminPendingDisputeReservationIds(now);
  return reservationIds.length;
}

/** Lịch sử tranh chấp đã xử lý (pickup + post-delivery). */
async function collectAdminResolvedDisputeReservationIds() {
  const [bothResolvedIds, postDeliveryResolvedIds] = await Promise.all([
    ReservationDispute.find(buildBothPartiesResolvedDisputeFilter()).distinct("reservationId"),
    ReservationDispute.find({
      status: { $ne: DISPUTE_STATUS.PENDING },
      disputeKind: "post_delivery",
    }).distinct("reservationId"),
  ]);

  return uniqueObjectIds([...bothResolvedIds, ...postDeliveryResolvedIds]);
}

module.exports = {
  collectAdminPendingDisputeReservationIds,
  collectAdminResolvedDisputeReservationIds,
  countAdminPendingDisputes,
  findPostDeliveryPendingDisputeReservationIds,
};

const { RESERVATION_TAB_STATUS_MAP } = require("../constants/reservationOrderFlow");
const {
  RESERVATION_STATUS,
  DEPOSIT_SETTLE_TO,
  DISPUTE_HISTORY_RETENTION_HOURS,
} = require("../constants");

function resolveReservationTabFilter(tab) {
  const normalized = String(tab || "holding").trim().toLowerCase();

  switch (normalized) {
    case "all":
      return { statusFilter: RESERVATION_TAB_STATUS_MAP.all, tabKey: "all" };
    case "pending":
    case "awaiting":
    case "awaiting_confirm":
      return { statusFilter: RESERVATION_TAB_STATUS_MAP.pending, tabKey: "pending" };
    case "holding":
      return { statusFilter: RESERVATION_TAB_STATUS_MAP.holding, tabKey: "holding" };
    case "dispute":
    case "disputes":
      return {
        statusFilter: [RESERVATION_STATUS.DISPUTED],
        extraQuery: { cocChuyenDen: DEPOSIT_SETTLE_TO.NONE },
        tabKey: "dispute",
      };
    case "dispute_active":
      return {
        statusFilter: [RESERVATION_STATUS.DISPUTED],
        extraQuery: { cocChuyenDen: DEPOSIT_SETTLE_TO.NONE },
        tabKey: "dispute_active",
      };
    case "dispute_resolved":
    case "dispute_resolved_history":
      return {
        statusFilter: [RESERVATION_STATUS.DISPUTED],
        extraQuery: {
          cocChuyenDen: { $in: [DEPOSIT_SETTLE_TO.BUYER, DEPOSIT_SETTLE_TO.SELLER] },
        },
        tabKey: "dispute_resolved",
      };
    case "dispute_history": {
      const cutoff = new Date(Date.now() - DISPUTE_HISTORY_RETENTION_HOURS * 60 * 60 * 1000);
      return {
        statusFilter: [RESERVATION_STATUS.DISPUTED],
        extraQuery: {
          cocChuyenDen: { $in: [DEPOSIT_SETTLE_TO.BUYER, DEPOSIT_SETTLE_TO.SELLER] },
          tgGiaiCoc: { $gte: cutoff },
        },
        tabKey: "dispute_history",
      };
    }
    case "cancelled":
      return { statusFilter: RESERVATION_TAB_STATUS_MAP.cancelled, tabKey: "cancelled" };
    case "completed":
      return {
        statusFilter: RESERVATION_TAB_STATUS_MAP.completed,
        tabKey: "completed",
      };
    case "completed_pickup":
      return {
        statusFilter: [RESERVATION_STATUS.PICKUP_CONFIRMED],
        extraQuery: { cocChuyenDen: DEPOSIT_SETTLE_TO.NONE },
        tabKey: "completed_pickup",
      };
    case "completed_done":
      return {
        statusFilter: [RESERVATION_STATUS.COMPLETED],
        tabKey: "completed_done",
      };
    default:
      return { statusFilter: RESERVATION_TAB_STATUS_MAP.holding, tabKey: "holding" };
  }
}

function applyTabFilterToQuery(reservationQuery, tab) {
  const { statusFilter, extraQuery, tabKey } = resolveReservationTabFilter(tab);
  if (statusFilter) {
    reservationQuery.status = { $in: statusFilter };
  }
  if (extraQuery) {
    Object.assign(reservationQuery, extraQuery);
  }
  return tabKey;
}

module.exports = {
  resolveReservationTabFilter,
  applyTabFilterToQuery,
};

const { Types } = require("mongoose");

function normalizeReservationId(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (Types.ObjectId.isValid(text)) {
    return text;
  }
  return "";
}

function buildOrderCode(reservationId) {
  const id = String(reservationId || "").trim();
  if (!id) {
    return "";
  }
  return id.slice(-8).toUpperCase();
}

/** QR đơn hàng — buyer hiển thị, seller quét. */
function buildPickupQrPayload({ reservationId, orderCode, buyerId } = {}) {
  const id = normalizeReservationId(reservationId);
  if (!id) {
    return "";
  }
  return JSON.stringify({
    v: 1,
    orderId: id,
    reservationId: id,
    orderCode: String(orderCode || buildOrderCode(id)).trim(),
    buyerId: String(buyerId || "").trim(),
  });
}

/** Parse QR buyer hiển thị → reservationId (+ metadata). */
function parsePickupQrPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const reservationId = normalizeReservationId(
        parsed.orderId || parsed.reservationId || parsed.id
      );
      if (reservationId) {
        return {
          reservationId,
          orderCode: String(parsed.orderCode || buildOrderCode(reservationId)).trim(),
          buyerId: String(parsed.buyerId || "").trim(),
        };
      }
    }
  } catch {
    // not JSON
  }

  const pipe = text.match(/^FM\|ORDER\|(.+)$/i);
  if (pipe?.[1]) {
    const reservationId = normalizeReservationId(pipe[1]);
    if (reservationId) {
      return {
        reservationId,
        orderCode: buildOrderCode(reservationId),
        buyerId: "",
      };
    }
  }

  const reservationId = normalizeReservationId(text);
  if (reservationId) {
    return {
      reservationId,
      orderCode: buildOrderCode(reservationId),
      buyerId: "",
    };
  }

  return null;
}

module.exports = {
  buildOrderCode,
  buildPickupQrPayload,
  parsePickupQrPayload,
};

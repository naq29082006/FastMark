/**
 * Migrate Reservation / ReservationDispute sang schema mới.
 * Usage: node backend/scripts/migrateReservationSchema.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Reservation = require("../models/Reservation");
const ReservationDispute = require("../models/ReservationDispute");
const { DISPUTE_CREATED_BY } = require("../constants");
const { normalizeDisputeReasonType } = require("../utils/disputeReasonType");
const { generatePickupCode } = require("../utils/reservationCompat");

const LEGACY_STATUS_TO_NEW = {
  0: 0,
  1: 6,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 6,
};

const { RESERVATION_STATUS } = require("../constants");

async function migrateReservations() {
  const col = Reservation.collection;
  const cursor = col.find({});
  let count = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const set = {};
    const unset = {};

    if (doc.buyerId && !doc.userId) {
      set.userId = doc.buyerId;
    }
    if (doc.hasReviewed !== undefined && doc.hasReview === undefined) {
      set.hasReview = Boolean(doc.hasReviewed);
    }
    if (doc.CreatedAt && !doc.createdAt) {
      set.createdAt = doc.CreatedAt;
    }
    if (doc.UpdatedAt && !doc.updatedAt) {
      set.updatedAt = doc.UpdatedAt;
    }
    if (!doc.tgNhanHang && doc.completedAt) {
      set.tgNhanHang = doc.completedAt;
    }
    if (doc.cancelledBySellerAfterAccept && !doc.cancelType) {
      set.cancelType = "seller_after_accept";
    }
    if (doc.cancelReason && !String(doc.cancelNote || "").trim()) {
      set.cancelNote = doc.cancelReason;
    }
    if (doc.cancelledBy && !String(doc.cancelType || "").trim()) {
      set.cancelType = doc.cancelledBy;
    }
    if (doc.legacyCancelNote && !String(doc.cancelNote || "").trim()) {
      set.cancelNote = doc.legacyCancelNote;
    }
    if ((doc.hasDispute || doc.disputed) && Number(doc.status) !== 3) {
      set.status = 3;
    }
    if (!doc.pickupCode) {
      set.pickupCode = generatePickupCode();
    }
    if (LEGACY_STATUS_TO_NEW[doc.status] !== undefined && doc.status !== LEGACY_STATUS_TO_NEW[doc.status]) {
      set.status = LEGACY_STATUS_TO_NEW[doc.status];
    }

    unset.disputed = "";
    unset.hasDispute = "";
    unset.hasReviewed = "";
    unset.CreatedAt = "";
    unset.UpdatedAt = "";
    unset.completedAt = "";
    unset.cancelNote = "";
    unset.cancelledBySellerAfterAccept = "";
    unset.buyerId = "";
    unset.sellerId = "";
    unset.depositPaidAt = "";
    unset.pickupExpiredAt = "";
    unset.buyerLatAtExpire = "";
    unset.buyerLngAtExpire = "";
    unset.sellerLatAtExpire = "";
    unset.sellerLngAtExpire = "";
    unset.expireDistanceMeters = "";
    unset.reviewDeadlineAt = "";
    unset.autoReleaseAt = "";
    unset.agreedPrice = "";
    unset.reasonCode = "";
    unset.pickupReminderSentAt = "";
    unset.buyerReceivedAt = "";
    unset.paymentStatus = "";

    if (!doc.hanGiaiCoc && doc.reviewDeadlineAt) {
      set.hanGiaiCoc = doc.reviewDeadlineAt;
    } else if (!doc.hanGiaiCoc && doc.autoReleaseAt) {
      set.hanGiaiCoc = doc.autoReleaseAt;
    }

    if (Object.keys(set).length || Object.keys(unset).length) {
      await col.updateOne({ _id: doc._id }, { $set: set, $unset: unset });
      count += 1;
    }
  }

  console.log(`Reservation: migrated ${count} documents`);
  return count;
}

async function migrateDisputes() {
  const col = ReservationDispute.collection;
  const cursor = col.find({});
  let count = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const set = {};
    const unset = {
      shopId: "",
      buyerId: "",
      sellerId: "",
      reason: "",
      resolvedBy: "",
      UpdatedAt: "",
      CreatedAt: "",
    };

    const createdByRaw = String(doc.createdBy || "").toLowerCase();
    if (createdByRaw === "buyer" || doc.createdBy === DISPUTE_CREATED_BY.BUYER) {
      set.createdBy = DISPUTE_CREATED_BY.BUYER;
    } else if (createdByRaw === "seller" || doc.createdBy === DISPUTE_CREATED_BY.SELLER) {
      set.createdBy = DISPUTE_CREATED_BY.SELLER;
    }

    if (doc.reason && !doc.reasonType) {
      set.reasonType = normalizeDisputeReasonType(doc.reason);
    }
    if (doc.CreatedAt && !doc.createdAt) {
      set.createdAt = doc.CreatedAt;
    }
    if (doc.status === 2) {
      set.status = 1;
    } else if (doc.status === 3) {
      set.status = 2;
    }

    await col.updateOne({ _id: doc._id }, { $set: set, $unset: unset });
    count += 1;
  }

  console.log(`ReservationDispute: migrated ${count} documents`);
  return count;
}

async function dropExpireLocationCollection() {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const exists = collections.some((row) => row.name === "reservationexpirelocations");
  if (!exists) {
    console.log("ReservationExpireLocation: collection not found, skip drop");
    return 0;
  }
  await mongoose.connection.db.dropCollection("reservationexpirelocations");
  console.log("ReservationExpireLocation: dropped collection");
  return 1;
}

async function run() {
  await connectDB();
  const total = (await migrateReservations()) + (await migrateDisputes()) + (await dropExpireLocationCollection());
  console.log(`Done. Total migrated: ${total}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

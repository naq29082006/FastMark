/**
 * Gộp ReservationAuditLog → ReservationDispute.auditLogs[]
 * và dữ liệu Report tranh chấp (5–7) → ReservationDispute (title/content/images).
 * Usage: node backend/scripts/migrateDisputeSchema.js
 */
require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const ReservationDispute = require("../models/ReservationDispute");
const Reservation = require("../models/Reservation");
const { partyHasComplaint } = require("../utils/reservationDisputeView");
const { normalizeEmbeddedImages } = require("../utils/embeddedImages");

function pickString(value) {
  return String(value || "").trim();
}

async function migrateAuditLogs() {
  const col = mongoose.connection.collection("reservationauditlogs");
  const rows = await col.find({}).sort({ CreatedAt: 1 }).toArray();
  const byReservation = new Map();

  for (const row of rows) {
    const key = String(row.reservationId);
    if (!byReservation.has(key)) {
      byReservation.set(key, []);
    }
    byReservation.get(key).push({
      adminId: row.adminId,
      action: pickString(row.action),
      decision: pickString(row.decision),
      note: pickString(row.note),
      createdAt: row.CreatedAt || new Date(),
    });
  }

  let updated = 0;
  for (const [reservationId, auditLogs] of byReservation.entries()) {
    const result = await ReservationDispute.updateOne(
      {
        reservationId: new mongoose.Types.ObjectId(reservationId),
        $or: [{ auditLogs: { $exists: false } }, { auditLogs: { $size: 0 } }],
      },
      { $set: { auditLogs } }
    );
    if (result.modifiedCount) {
      updated += 1;
    }
  }

  console.log(
    `AuditLogs: merged ${rows.length} rows into ${byReservation.size} disputes (${updated} updated)`
  );
  return updated;
}

/**
 * Migrate nested / legacy dispute → field phẳng buyer* / seller*.
 */
function flatComplaintPatch(party, complaint) {
  if (party === "seller") {
    return {
      sellerShopId: complaint.shopId || null,
      sellerReasonType: complaint.reasonType ?? 99,
      sellerContent: pickString(complaint.content),
      sellerImages: normalizeEmbeddedImages(complaint.images || []),
      sellerComplaintAt: complaint.createdAt || new Date(),
    };
  }
  return {
    buyerUserId: complaint.userId || null,
    buyerReasonType: complaint.reasonType ?? 99,
    buyerContent: pickString(complaint.content),
    buyerImages: normalizeEmbeddedImages(complaint.images || []),
    buyerComplaintAt: complaint.createdAt || new Date(),
  };
}

async function migratePartyComplaints() {
  const rows = await ReservationDispute.find({}).lean();
  let updated = 0;

  for (const row of rows) {
    if (
      row.buyerReasonType != null ||
      row.sellerReasonType != null ||
      row.buyerContent ||
      row.sellerContent
    ) {
      continue;
    }

    const patch = {};
    if (hasComplaintPayload(row.buyerComplaint)) {
      Object.assign(patch, flatComplaintPatch("buyer", row.buyerComplaint));
    }
    if (hasComplaintPayload(row.sellerComplaint)) {
      const sellerPayload = { ...row.sellerComplaint };
      if (!sellerPayload.shopId && row.reservationId) {
        const reservation = await Reservation.findById(row.reservationId).select("shopId").lean();
        sellerPayload.shopId = reservation?.shopId || null;
      }
      Object.assign(patch, flatComplaintPatch("seller", sellerPayload));
    }

    if (!Object.keys(patch).length) {
      const createdBy = Number(row.createdBy);
      const legacy = {
        userId: row.userId || null,
        reasonType: row.reasonType ?? 99,
        title: pickString(row.title),
        content: pickString(row.content || row.description),
        images: row.images || [],
        createdAt: row.createdAt || row.CreatedAt || new Date(),
      };
      if (createdBy === 2 && hasLegacyComplaint(row)) {
        const reservation = row.reservationId
          ? await Reservation.findById(row.reservationId).select("shopId").lean()
          : null;
        Object.assign(
          patch,
          flatComplaintPatch("seller", { ...legacy, shopId: reservation?.shopId || null })
        );
      } else if (hasLegacyComplaint(row)) {
        Object.assign(patch, flatComplaintPatch("buyer", legacy));
      }
    }

    if (!Object.keys(patch).length) {
      continue;
    }

    const unset = {
      userId: "",
      createdBy: "",
      reasonType: "",
      title: "",
      content: "",
      description: "",
      images: "",
      latitude: "",
      longitude: "",
      address: "",
      buyerComplaint: "",
      sellerComplaint: "",
      sellerUserId: "",
    };

    await ReservationDispute.updateOne({ _id: row._id }, { $set: patch, $unset: unset });
    updated += 1;
  }

  console.log(`Flat complaints: migrated ${updated} disputes`);
  return updated;
}

function hasComplaintPayload(complaint) {
  if (!complaint) {
    return false;
  }
  const reasonType = Number(complaint.reasonType);
  return Boolean(
    (Number.isFinite(reasonType) && reasonType > 0) ||
      pickString(complaint.content) ||
      (Array.isArray(complaint.images) && complaint.images.length)
  );
}

function hasLegacyComplaint(row) {
  return Boolean(
    pickString(row.title) ||
      pickString(row.content || row.description) ||
      (Array.isArray(row.images) && row.images.length)
  );
}

async function migrateDisputeReports() {
  const col = mongoose.connection.collection("reports");
  const rows = await col
    .find({ reportType: { $in: [5, 6, 7] }, reservationId: { $exists: true, $ne: null } })
    .sort({ CreatedAt: 1 })
    .toArray();

  let updated = 0;
  for (const report of rows) {
    const reservationId = report.reservationId;
    const isSeller = Number(report.reporterRole) === 2 || Number(report.reportType) === 5;
    const title =
      pickString(report.title) ||
      pickString(report.sellerTitle) ||
      "";
    const content =
      pickString(report.content) ||
      pickString(report.sellerContent) ||
      pickString(report.description) ||
      "";
    const images = normalizeEmbeddedImages(report.images || []);

    const existing = await ReservationDispute.findOne({ reservationId }).lean();
    if (existing) {
      const party = isSeller ? "seller" : "buyer";
      if (partyHasComplaint(existing, party)) {
        continue;
      }
      const patch = flatComplaintPatch(party, {
        shopId: isSeller ? report.shopId || null : null,
        userId: !isSeller ? report.userId || null : null,
        reasonType: isSeller ? 6 : 99,
        title,
        content,
        images,
        createdAt: report.CreatedAt || new Date(),
      });
      if (isSeller && !patch.sellerShopId && reservationId) {
        const reservation = await Reservation.findById(reservationId).select("shopId").lean();
        patch.sellerShopId = reservation?.shopId || null;
      }
      await ReservationDispute.updateOne({ _id: existing._id }, { $set: patch });
      updated += 1;
      continue;
    }

    const party = isSeller ? "seller" : "buyer";
    const createPayload = {
      userId: !isSeller ? report.userId || null : null,
      shopId: isSeller ? report.shopId || null : null,
      reasonType: isSeller ? 6 : 99,
      title,
      content,
      images,
      createdAt: report.CreatedAt || new Date(),
    };
    if (isSeller && !createPayload.shopId && reservationId) {
      const reservation = await Reservation.findById(reservationId).select("shopId").lean();
      createPayload.shopId = reservation?.shopId || null;
    }
    await ReservationDispute.create({
      reservationId,
      ...flatComplaintPatch(party, createPayload),
      status: Number(report.status) === 2 ? 3 : 0,
      adminNote: pickString(report.adminNote),
      createdAt: report.CreatedAt || new Date(),
      updatedAt: report.UpdatedAt || new Date(),
      auditLogs: [],
    });
    updated += 1;
  }

  console.log(`Reports→Dispute: processed ${rows.length} reservation reports (${updated} upserted/updated)`);
  return updated;
}

async function migrateDescriptionToContent() {
  const result = await ReservationDispute.updateMany(
    {
      $or: [{ content: { $exists: false } }, { content: "" }],
      description: { $exists: true, $ne: "" },
    },
    [{ $set: { content: "$description" } }]
  );
  console.log(`Dispute content: backfilled ${result.modifiedCount || 0} from description`);
  return result.modifiedCount || 0;
}

async function unsetDisputeTitles() {
  const result = await ReservationDispute.updateMany(
    {
      $or: [
        { buyerTitle: { $exists: true } },
        { sellerTitle: { $exists: true } },
      ],
    },
    { $unset: { buyerTitle: "", sellerTitle: "" } }
  );
  console.log(`Dispute titles: unset ${result.modifiedCount || 0} documents`);
  return result.modifiedCount || 0;
}

async function run() {
  await connectDB();
  const total =
    (await migratePartyComplaints()) +
    (await migrateDisputeReports()) +
    (await migrateAuditLogs()) +
    (await unsetDisputeTitles());
  console.log(`Done. Total updates: ${total}`);
  console.log(
    "Optional cleanup: db.reservationauditlogs.drop(); archive old reports type 5–7 if no longer needed."
  );
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

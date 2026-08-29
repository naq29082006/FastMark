const SellerPlan = require("../models/SellerPlan");
const {
  RECORD_STATUS,
  isRecordActive,
  activeRecordFilter,
} = require("../constants");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveDurationDays(payload = {}) {
  if (payload.durationDays !== undefined && payload.durationDays !== null && payload.durationDays !== "") {
    return Number(payload.durationDays);
  }
  if (payload.durationMonths !== undefined && payload.durationMonths !== null && payload.durationMonths !== "") {
    return Number(payload.durationMonths) * 30;
  }
  if (payload.planMonths !== undefined && payload.planMonths !== null && payload.planMonths !== "") {
    return Number(payload.planMonths) * 30;
  }
  return NaN;
}

function toPlanDto(doc) {
  const durationDays = Math.max(1, Number(doc.durationDays) || 30);
  const planMonths = Math.max(1, Math.round(durationDays / 30));
  return {
    id: String(doc._id),
    name: doc.name || "",
    description: doc.description || "",
    durationDays,
    durationMonths: planMonths,
    price: Math.max(0, Number(doc.price) || 0),
    isActive: isRecordActive(doc.isActive),
    createdAt: doc.CreatedAt || null,
    updatedAt: doc.UpdatedAt || null,
    // Compat aliases
    label: doc.name || "",
    planMonths,
  };
}

async function listAdminPlans() {
  const rows = await SellerPlan.find(activeRecordFilter())
    .sort({ price: 1, CreatedAt: 1 })
    .limit(100);
  return rows.map(toPlanDto);
}

async function listActivePlans() {
  const rows = await SellerPlan.find(activeRecordFilter())
    .sort({ price: 1, CreatedAt: 1 })
    .limit(50);
  return rows.map(toPlanDto);
}

async function getActivePlanById(planId) {
  const plan = await SellerPlan.findOne({ _id: planId, ...activeRecordFilter() });
  return plan || null;
}

async function createPlan(payload = {}) {
  const name = String(payload.name || payload.label || "").trim();
  const description = String(payload.description || "").trim();
  const durationDays = resolveDurationDays(payload);
  const price = Number(payload.price);
  const isActive =
    payload.isActive === undefined
      ? payload.status === undefined || Number(payload.status) === 1
      : isRecordActive(payload.isActive);

  if (!name) {
    throw createServiceError("Thiếu tên gói.");
  }
  if (!Number.isFinite(durationDays) || durationDays < 1) {
    throw createServiceError("Thời hạn phải >= 1 ngày.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw createServiceError("Giá gói không hợp lệ.");
  }

  const existing = await SellerPlan.findOne({ name });
  if (existing) {
    if (!isRecordActive(existing.isActive)) {
      existing.description = description;
      existing.durationDays = Math.round(durationDays);
      existing.price = price;
      existing.isActive = RECORD_STATUS.ACTIVE;
      existing.UpdatedAt = new Date();
      await existing.save();
      return { plan: toPlanDto(existing), restored: true };
    }
    throw createServiceError("Tên gói đã tồn tại.");
  }

  const plan = await SellerPlan.create({
    name,
    description,
    durationDays: Math.round(durationDays),
    price,
    isActive: isActive ? RECORD_STATUS.ACTIVE : RECORD_STATUS.HIDDEN,
  });
  return { plan: toPlanDto(plan), restored: false };
}

async function updatePlan(planId, payload = {}) {
  const plan = await SellerPlan.findById(planId);
  if (!plan) {
    throw createServiceError("Không tìm thấy gói.", 404);
  }

  if (payload.name !== undefined || payload.label !== undefined) {
    const name = String(payload.name || payload.label || "").trim();
    if (!name) {
      throw createServiceError("Thiếu tên gói.");
    }
    plan.name = name;
  }
  if (payload.description !== undefined) {
    plan.description = String(payload.description || "").trim();
  }

  const hasDurationField =
    payload.durationDays !== undefined ||
    payload.durationMonths !== undefined ||
    payload.planMonths !== undefined;
  if (hasDurationField) {
    const durationDays = resolveDurationDays(payload);
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      throw createServiceError("Thời hạn phải >= 1 ngày.");
    }
    plan.durationDays = Math.round(durationDays);
  }

  if (payload.price !== undefined) {
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0) {
      throw createServiceError("Giá gói không hợp lệ.");
    }
    plan.price = price;
  }

  if (payload.isActive !== undefined || payload.status !== undefined) {
    const nextActive =
      payload.isActive !== undefined
        ? isRecordActive(payload.isActive)
        : Number(payload.status) === RECORD_STATUS.ACTIVE;
    plan.isActive = nextActive ? RECORD_STATUS.ACTIVE : RECORD_STATUS.HIDDEN;
  }

  await plan.save();
  return toPlanDto(plan);
}

async function deletePlan(planId) {
  const plan = await SellerPlan.findById(planId);
  if (!plan) {
    throw createServiceError("Không tìm thấy gói.", 404);
  }
  plan.isActive = RECORD_STATUS.HIDDEN;
  await plan.save();
  return toPlanDto(plan);
}

async function restorePlan(planId) {
  const plan = await SellerPlan.findById(planId);
  if (!plan) {
    throw createServiceError("Không tìm thấy gói.", 404);
  }
  if (isRecordActive(plan.isActive)) {
    return toPlanDto(plan);
  }
  plan.isActive = RECORD_STATUS.ACTIVE;
  await plan.save();
  return toPlanDto(plan);
}

module.exports = {
  listAdminPlans,
  listActivePlans,
  getActivePlanById,
  createPlan,
  updatePlan,
  deletePlan,
  restorePlan,
  toPlanDto,
};

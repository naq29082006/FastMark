const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const SystemWallet = require("../models/SystemWallet");
const WithdrawRequest = require("../models/WithdrawRequest");
const { getPayosClient } = require("./payosClient");
const {
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  WALLET_TX_TYPE_LABEL,
  WALLET_TX_STATUS_LABEL,
  WALLET_REFERENCE_TYPE,
  MIN_TOPUP_AMOUNT,
  MAX_TOPUP_AMOUNT,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_INDEX,
} = require("../constants");
const { createNotification } = require("./notificationService");
const { emitAdminUpdated, emitUserResourceUpdated } = require("./realtimeService");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveTransactionReservationId(tx) {
  if (tx?.reservationId) {
    return String(tx.reservationId);
  }
  if (String(tx?.referenceType || "") === WALLET_REFERENCE_TYPE.RESERVATION && tx?.referenceId) {
    return String(tx.referenceId);
  }
  return null;
}

function toPublicTransaction(tx, extras = {}) {
  return {
    id: String(tx._id),
    type: Number(tx.type),
    typeLabel: WALLET_TX_TYPE_LABEL[tx.type] || "Giao dịch",
    amount: Number(tx.amount) || 0,
    status: Number(tx.status),
    statusLabel: WALLET_TX_STATUS_LABEL[tx.status] || "",
    orderCode: Number(tx.orderCode) || null,
    paymentLinkId: tx.paymentLinkId || "",
    description: tx.description || "",
    balanceBefore: tx.balanceBefore == null ? null : Number(tx.balanceBefore),
    balanceAfter: tx.balanceAfter == null ? null : Number(tx.balanceAfter),
    reservationId: resolveTransactionReservationId(tx),
    referenceId: tx.referenceId ? String(tx.referenceId) : null,
    referenceType: tx.referenceType || "",
    createdAt: tx.CreatedAt,
    updatedAt: tx.UpdatedAt,
    ...extras,
  };
}

async function enrichWithdrawTransaction(tx, publicTx) {
  if (Number(tx.type) !== WALLET_TX_TYPE.WITHDRAWAL) {
    return publicTx;
  }

  let withdraw = null;
  if (
    tx.referenceId &&
    String(tx.referenceType || "") === WALLET_REFERENCE_TYPE.WITHDRAW
  ) {
    withdraw = await WithdrawRequest.findById(tx.referenceId).lean();
  }
  if (!withdraw) {
    withdraw = await WithdrawRequest.findOne({ gdViId: tx._id }).lean();
  }
  if (!withdraw) {
    return publicTx;
  }

  return {
    ...publicTx,
    bankName: withdraw.bankName || "",
    bankCode: withdraw.bankCode || "",
    accountNumber: withdraw.accountNumber || "",
    accountName: withdraw.accountName || "",
    withdrawStatus: Number(withdraw.status),
    adminNote: withdraw.adminNote || "",
  };
}

async function getOrCreateWallet(userId, session = null) {
  const query = Wallet.findOne({ userId });
  if (session) {
    query.session(session);
  }
  let wallet = await query;
  if (wallet) {
    return wallet;
  }

  try {
    const created = await Wallet.create(
      [{ userId, balance: 0 }],
      session ? { session } : undefined
    );
    return created[0];
  } catch (error) {
    if (error?.code === 11000) {
      const retry = Wallet.findOne({ userId });
      if (session) {
        retry.session(session);
      }
      return await retry;
    }
    throw error;
  }
}

async function getWalletBalance(userId) {
  const wallet = await getOrCreateWallet(userId);
  return {
    balance: Math.max(0, Number(wallet.balance) || 0),
    updatedAt: wallet.UpdatedAt,
  };
}

/** Push số dư mới tới app (tab Tài khoản + màn Ví). Bỏ qua khi gọi trong Mongo session — emit sau commit. */
function notifyWalletBalanceUpdated(userId, walletOrBalance, extra = {}) {
  if (!userId) {
    return;
  }
  const balance =
    typeof walletOrBalance === "number"
      ? Math.max(0, Math.round(walletOrBalance))
      : Math.max(0, Number(walletOrBalance?.balance) || 0);

  emitUserResourceUpdated(userId, "wallet", { balance, ...extra });
  emitAdminUpdated("wallet", { userId: String(userId), balance, ...extra });
}

function generateOrderCode() {
  const base = Date.now() % 1000000000;
  const rand = Math.floor(Math.random() * 900) + 100;
  return Number(`${base}${rand}`.slice(0, 15));
}

async function createUniqueOrderCode(session = null) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const orderCode = generateOrderCode();
    const existsQuery = WalletTransaction.exists({ orderCode });
    if (session) {
      existsQuery.session(session);
    }
    const exists = await existsQuery;
    if (!exists) {
      return orderCode;
    }
  }
  throw createServiceError("Không tạo được mã giao dịch. Thử lại.", 500);
}

function mongoSessionOptions(session) {
  return session ? { session } : {};
}

async function readUserWalletBalance(userId, session = null) {
  const wallet = await getOrCreateWallet(userId, session);
  return Math.max(0, Number(wallet?.balance) || 0);
}

/** Cập nhật số dư ví user bằng $inc (atomic) — tránh lệch ledger vs bảng wallets. */
async function applyUserWalletDelta(userId, delta, session = null) {
  const change = Math.round(Number(delta));
  if (!Number.isFinite(change) || change === 0) {
    return getOrCreateWallet(userId, session);
  }

  const baseOpts = { returnDocument: "after", runValidators: true, ...mongoSessionOptions(session) };

  if (change > 0) {
    const updated = await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { balance: change } },
      { ...baseOpts, upsert: true, setDefaultsOnInsert: true }
    );
    if (!updated) {
      throw createServiceError("Không cập nhật được số dư ví.", 500);
    }
    updated.balance = Math.max(0, Number(updated.balance) || 0);
    return updated;
  }

  const debit = Math.abs(change);
  const updated = await Wallet.findOneAndUpdate(
    { userId, balance: { $gte: debit } },
    { $inc: { balance: change } },
    baseOpts
  );
  if (!updated) {
    throw createServiceError(
      `Số dư ví không đủ. Cần ${debit.toLocaleString("vi-VN")}đ.`,
      400
    );
  }
  updated.balance = Math.max(0, Number(updated.balance) || 0);
  return updated;
}

/** Cập nhật số dư ví hệ thống (cọc escrow) bằng $inc. */
async function applySystemWalletDelta(delta, session = null) {
  const change = Math.round(Number(delta));
  if (!Number.isFinite(change) || change === 0) {
    return getOrCreateSystemWallet(session);
  }

  const wallet = await getOrCreateSystemWallet(session);
  const baseOpts = { returnDocument: "after", runValidators: true, ...mongoSessionOptions(session) };

  if (change > 0) {
    const updated = await SystemWallet.findOneAndUpdate(
      { _id: wallet._id },
      { $inc: { balance: change } },
      baseOpts
    );
    if (!updated) {
      throw createServiceError("Không cập nhật được ví hệ thống.", 500);
    }
    updated.balance = Math.max(0, Number(updated.balance) || 0);
    return updated;
  }

  const debit = Math.abs(change);
  const updated = await SystemWallet.findOneAndUpdate(
    { _id: wallet._id, balance: { $gte: debit } },
    { $inc: { balance: change } },
    baseOpts
  );
  if (!updated) {
    throw createServiceError("Số dư ví hệ thống không đủ để hoàn cọc.", 500);
  }
  updated.balance = Math.max(0, Number(updated.balance) || 0);
  return updated;
}

/** Đồng bộ wallets.balance theo balanceAfter giao dịch thành công mới nhất (sửa dữ liệu lệch). */
async function reconcileUserWalletBalanceFromLedger(userId) {
  const latest = await WalletTransaction.findOne({
    userId,
    status: WALLET_TX_STATUS.SUCCESS,
    balanceAfter: { $ne: null },
  })
    .sort({ CreatedAt: -1, _id: -1 })
    .select("balanceAfter")
    .lean();

  if (latest?.balanceAfter == null) {
    return null;
  }

  const target = Math.max(0, Math.round(Number(latest.balanceAfter)));
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $set: { balance: target, UpdatedAt: new Date() } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
  return wallet;
}

function resolveReturnUrls() {
  const returnUrl =
    String(process.env.PAYOS_RETURN_URL || "").trim() ||
    "fastmark://wallet/topup-result?status=success";
  const cancelUrl =
    String(process.env.PAYOS_CANCEL_URL || "").trim() ||
    "fastmark://wallet/topup-result?status=cancel";
  return { returnUrl, cancelUrl };
}

/** Nội dung CK trên PayOS/VietQR — dùng userId (24 hex) để đối soát, vừa trong giới hạn 25 ký tự. */
function buildPayosDescription(user) {
  const userId = String(user?._id || user?.id || "").trim();
  if (/^[a-fA-F0-9]{24}$/.test(userId)) {
    return userId;
  }
  return userId.slice(0, 25) || "FastMark";
}

const PAYOS_BIN_LABELS = {
  "970422": "Ngân hàng TMCP Quân đội",
  "970436": "Ngân hàng TMCP Ngoại thương Việt Nam",
  "970415": "Ngân hàng TMCP Công thương Việt Nam",
  "970418": "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
  "970407": "Ngân hàng TMCP Kỹ thương Việt Nam",
  "970416": "Ngân hàng TMCP Á Châu",
  "970432": "Ngân hàng TMCP Việt Nam Thịnh Vượng",
  "970403": "Ngân hàng TMCP Sài Gòn Thương Tín",
  "970405": "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
  "970448": "Ngân hàng TMCP Phương Đông",
};

function resolvePayosBankLabel(bin) {
  const key = String(bin || "").trim();
  return PAYOS_BIN_LABELS[key] || (key ? `Ngân hàng (${key})` : "");
}

async function applySuccessfulTopup(orderCode, { amount, paymentLinkId } = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tx = await WalletTransaction.findOne({ orderCode }).session(session);
    if (!tx) {
      await session.abortTransaction();
      return { handled: false, reason: "transaction_not_found" };
    }

    if (tx.status === WALLET_TX_STATUS.SUCCESS) {
      await session.commitTransaction();
      return { handled: true, idempotent: true, transactionId: String(tx._id) };
    }

    if (amount != null && Number(tx.amount) !== Math.round(Number(amount))) {
      tx.status = WALLET_TX_STATUS.FAILED;
      await tx.save({ session });
      await session.commitTransaction();
      throw createServiceError("Số tiền không khớp giao dịch.", 400);
    }

    const wallet = await getOrCreateWallet(tx.userId, session);
    wallet.balance = Math.max(0, Number(wallet.balance) || 0) + Number(tx.amount);
    await wallet.save({ session });

    tx.status = WALLET_TX_STATUS.SUCCESS;
    tx.balanceAfter = wallet.balance;
    if (paymentLinkId) {
      tx.paymentLinkId = String(paymentLinkId);
    }
    await tx.save({ session });

    await session.commitTransaction();

    await createNotification(tx.userId, {
      title: "Nạp tiền thành công",
      content: `Đã nạp ${Number(tx.amount).toLocaleString("vi-VN")}đ vào ví FastMark.`,
      audience: NOTIFICATION_AUDIENCE.SYSTEM,
      index: NOTIFICATION_INDEX.SYSTEM,
    }).catch((error) => {
      console.warn("[wallet] topup notification failed:", error?.message || error);
    });

    emitUserResourceUpdated(tx.userId, "wallet", {
      transactionId: String(tx._id),
      orderCode: tx.orderCode,
      balance: wallet.balance,
    });
    emitAdminUpdated("wallet", {
      userId: String(tx.userId),
      transactionId: String(tx._id),
      orderCode: tx.orderCode,
    });

    return {
      handled: true,
      credited: true,
      transactionId: String(tx._id),
      balance: wallet.balance,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function createTopup(user, amountInput) {
  const amount = Math.round(Number(amountInput));
  if (!Number.isFinite(amount) || amount < MIN_TOPUP_AMOUNT) {
    throw createServiceError(
      `Số tiền nạp tối thiểu là ${MIN_TOPUP_AMOUNT.toLocaleString("vi-VN")}đ.`
    );
  }
  if (amount > MAX_TOPUP_AMOUNT) {
    throw createServiceError(
      `Số tiền nạp tối đa là ${MAX_TOPUP_AMOUNT.toLocaleString("vi-VN")}đ.`
    );
  }

  await getOrCreateWallet(user._id);
  const orderCode = await createUniqueOrderCode();
  const { returnUrl, cancelUrl } = resolveReturnUrls();
  const payosDescription = buildPayosDescription(user);
  const internalDescription = `Nạp ví · ${payosDescription}`;

  const payos = getPayosClient();
  const createPayload = {
    orderCode,
    amount,
    description: payosDescription,
    returnUrl,
    cancelUrl,
  };
  const buyerName = String(user.FullName || user.UserName || "").trim();
  if (buyerName) {
    createPayload.buyerName = buyerName;
  }
  const paymentLink = await payos.paymentRequests.create(createPayload);

  const tx = await WalletTransaction.create({
    userId: user._id,
    type: WALLET_TX_TYPE.TOPUP,
    amount,
    status: WALLET_TX_STATUS.PENDING,
    orderCode,
    paymentLinkId: String(paymentLink.paymentLinkId || ""),
    checkoutUrl: String(paymentLink.checkoutUrl || ""),
    description: internalDescription,
  });

  return {
    transaction: toPublicTransaction(tx),
    checkoutUrl: String(paymentLink.checkoutUrl || ""),
    orderCode,
    paymentLinkId: String(paymentLink.paymentLinkId || ""),
    qrCode: String(paymentLink.qrCode || ""),
    accountNumber: String(paymentLink.accountNumber || ""),
    accountName: String(paymentLink.accountName || ""),
    bin: String(paymentLink.bin || ""),
    bankName: resolvePayosBankLabel(paymentLink.bin),
    amount,
    description: payosDescription,
  };
}

async function listTransactions(userId, { page, limit, type } = {}) {
  const { page: safePage, limit: safeLimit, skip } = parsePagination({ page, limit });
  const filter = { userId };
  const typeNum = Number(type);
  if (Number.isFinite(typeNum) && typeNum > 0) {
    filter.type = typeNum;
  }
  const [rows, total] = await Promise.all([
    WalletTransaction.find(filter).sort({ CreatedAt: -1, _id: -1 }).skip(skip).limit(safeLimit),
    WalletTransaction.countDocuments(filter),
  ]);
  return {
    transactions: rows.map(toPublicTransaction),
    items: rows.map(toPublicTransaction),
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

async function getTransaction(userId, transactionId) {
  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    throw createServiceError("Giao dịch không hợp lệ.", 404);
  }
  const tx = await WalletTransaction.findOne({ _id: transactionId, userId });
  if (!tx) {
    throw createServiceError("Không tìm thấy giao dịch.", 404);
  }
  return enrichWithdrawTransaction(tx, toPublicTransaction(tx));
}

async function creditTopupFromWebhook(webhookPayload) {
  const payos = getPayosClient();
  const verified = await payos.webhooks.verify(webhookPayload);
  const data = verified?.data || verified;
  const orderCode = Number(data?.orderCode);
  const amount = Math.round(Number(data?.amount));
  const code = String(data?.code ?? verified?.code ?? "");
  const success =
    verified?.success === true || code === "00" || String(data?.code || "") === "00";

  if (!Number.isFinite(orderCode)) {
    throw createServiceError("Webhook thiếu orderCode.", 400);
  }

  if (!success) {
    const tx = await WalletTransaction.findOne({ orderCode });
    if (tx && tx.status === WALLET_TX_STATUS.PENDING) {
      tx.status = WALLET_TX_STATUS.FAILED;
      await tx.save();
    }
    return { handled: true, failed: true, orderCode };
  }

  return applySuccessfulTopup(orderCode, {
    amount,
    paymentLinkId: data?.paymentLinkId,
  });
}

async function syncTopupStatus(user, orderCodeInput) {
  const orderCode = Number(orderCodeInput);
  if (!Number.isFinite(orderCode)) {
    throw createServiceError("Mã giao dịch không hợp lệ.");
  }

  let tx = await WalletTransaction.findOne({ orderCode, userId: user._id });
  if (!tx) {
    throw createServiceError("Không tìm thấy giao dịch.", 404);
  }

  if (tx.status !== WALLET_TX_STATUS.SUCCESS) {
    const payos = getPayosClient();
    try {
      const paymentInfo = await payos.paymentRequests.get(orderCode);
      const status = String(paymentInfo?.status || "").toUpperCase();
      if (status === "PAID") {
        await applySuccessfulTopup(orderCode, {
          amount: tx.amount,
          paymentLinkId: paymentInfo?.paymentLinkId || tx.paymentLinkId,
        });
      } else if (status === "CANCELLED" || status === "EXPIRED") {
        if (tx.status === WALLET_TX_STATUS.PENDING) {
          tx.status = WALLET_TX_STATUS.CANCELLED;
          tx.UpdatedAt = new Date();
          await tx.save();
        }
      }
    } catch {
      // Keep pending if PayOS lookup fails; client can retry.
    }
    tx = await WalletTransaction.findOne({ orderCode, userId: user._id });
  }

  const wallet = await getWalletBalance(user._id);
  return { transaction: toPublicTransaction(tx), wallet };
}

/** User hủy nạp (nút Hủy trên PayOS / đóng WebView) → PENDING → CANCELLED. */
async function cancelTopup(user, orderCodeInput) {
  const orderCode = Number(orderCodeInput);
  if (!Number.isFinite(orderCode)) {
    throw createServiceError("Mã giao dịch không hợp lệ.");
  }

  let tx = await WalletTransaction.findOne({ orderCode, userId: user._id });
  if (!tx) {
    throw createServiceError("Không tìm thấy giao dịch.", 404);
  }

  if (tx.status === WALLET_TX_STATUS.SUCCESS) {
    throw createServiceError("Giao dịch đã thanh toán thành công, không thể hủy.");
  }

  if (tx.status === WALLET_TX_STATUS.PENDING) {
    // Hủy link trên PayOS nếu còn (best-effort).
    try {
      const payos = getPayosClient();
      if (typeof payos.paymentRequests?.cancel === "function") {
        await payos.paymentRequests.cancel(orderCode);
      }
    } catch {
      // Vẫn đánh dấu hủy phía FastMark.
    }

    tx.status = WALLET_TX_STATUS.CANCELLED;
    tx.UpdatedAt = new Date();
    await tx.save();
  }

  const wallet = await getWalletBalance(user._id);
  return { transaction: toPublicTransaction(tx), wallet };
}

async function debitWallet(userId, amount, { description, session, referenceId, referenceType } = {}) {
  const debitAmount = Math.round(Number(amount));
  if (!Number.isFinite(debitAmount) || debitAmount <= 0) {
    throw createServiceError("Số tiền trừ ví không hợp lệ.");
  }

  const wallet = await getOrCreateWallet(userId, session);
  const balance = Math.max(0, Number(wallet.balance) || 0);
  if (balance < debitAmount) {
    throw createServiceError(
      `Số dư ví không đủ. Cần ${debitAmount.toLocaleString("vi-VN")}đ, hiện có ${balance.toLocaleString("vi-VN")}đ.`,
      400
    );
  }

  wallet.balance = balance - debitAmount;
  await wallet.save(session ? { session } : undefined);

  const orderCode = Date.now() % 1000000000000;
  const created = await WalletTransaction.create(
    [
      {
        userId,
        type: WALLET_TX_TYPE.PAYMENT,
        amount: debitAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Thanh toán từ ví",
        balanceAfter: wallet.balance,
        ...(referenceId ? { referenceId } : {}),
        ...(referenceType ? { referenceType } : {}),
      },
    ],
    session ? { session } : undefined
  );

  return { wallet, transaction: created[0] };
}

async function creditWalletRefund(userId, amount, { description, session } = {}) {
  const creditAmount = Math.round(Number(amount));
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    return null;
  }

  const wallet = await getOrCreateWallet(userId, session);
  wallet.balance = Math.max(0, Number(wallet.balance) || 0) + creditAmount;
  await wallet.save(session ? { session } : undefined);

  const orderCode = await createUniqueOrderCode();
  const created = await WalletTransaction.create(
    [
      {
        userId,
        type: WALLET_TX_TYPE.REFUND,
        amount: creditAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Hoàn tiền về ví",
        balanceAfter: wallet.balance,
      },
    ],
    session ? { session } : undefined
  );

  return { wallet, transaction: created[0] };
}

async function getOrCreateSystemWallet(session = null) {
  const query = SystemWallet.findOne().sort({ _id: 1 });
  if (session) {
    query.session(session);
  }
  let wallet = await query;
  if (wallet) {
    return wallet;
  }
  try {
    const created = await SystemWallet.create(
      [{ balance: 0 }],
      session ? { session } : undefined
    );
    return created[0];
  } catch (error) {
    if (error?.code === 11000) {
      const retry = SystemWallet.findOne().sort({ _id: 1 });
      if (session) {
        retry.session(session);
      }
      return await retry;
    }
    throw error;
  }
}

/** Buyer Wallet → System Wallet (đặt cọc). */
async function holdDepositToSystem(userId, amount, { description, reservationId, session } = {}) {
  const holdAmount = Math.round(Number(amount));
  if (!Number.isFinite(holdAmount) || holdAmount <= 0) {
    throw createServiceError("Số tiền cọc không hợp lệ.");
  }

  const userWallet = await getOrCreateWallet(userId, session);
  const balanceBefore = Math.max(0, Number(userWallet.balance) || 0);
  if (balanceBefore < holdAmount) {
    throw createServiceError(
      `Số dư ví không đủ. Cần ${holdAmount.toLocaleString("vi-VN")}đ, hiện có ${balanceBefore.toLocaleString("vi-VN")}đ.`,
      400
    );
  }

  const userWalletAfter = await applyUserWalletDelta(userId, -holdAmount, session);
  await applySystemWalletDelta(holdAmount, session);

  const orderCode = await createUniqueOrderCode(session);
  const created = await WalletTransaction.create(
    [
      {
        userId,
        type: WALLET_TX_TYPE.DEPOSIT_HOLD,
        amount: holdAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Đặt cọc giữ hàng (Reservation Deposit)",
        balanceBefore,
        balanceAfter: userWalletAfter.balance,
        reservationId: reservationId || null,
        referenceId: reservationId || null,
        referenceType: reservationId ? WALLET_REFERENCE_TYPE.RESERVATION : "",
      },
    ],
    mongoSessionOptions(session)
  );

  const result = {
    userWallet: userWalletAfter,
    systemWallet: await getOrCreateSystemWallet(session),
    transaction: created[0],
  };
  if (!session) {
    notifyWalletBalanceUpdated(userId, userWalletAfter, {
      transactionId: String(created[0]._id),
    });
  }
  return result;
}

/** System Wallet → Buyer Wallet (hoàn cọc). */
async function refundDepositFromSystem(
  userId,
  amount,
  { description, reservationId, session } = {}
) {
  const creditAmount = Math.round(Number(amount));
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    return null;
  }

  const balanceBefore = await readUserWalletBalance(userId, session);
  await applySystemWalletDelta(-creditAmount, session);
  const userWalletAfter = await applyUserWalletDelta(userId, creditAmount, session);

  const orderCode = await createUniqueOrderCode(session);
  const created = await WalletTransaction.create(
    [
      {
        userId,
        type: WALLET_TX_TYPE.DEPOSIT_REFUND,
        amount: creditAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Hoàn cọc giữ hàng (Reservation Refund)",
        balanceBefore,
        balanceAfter: userWalletAfter.balance,
        reservationId: reservationId || null,
        referenceId: reservationId || null,
        referenceType: reservationId ? WALLET_REFERENCE_TYPE.RESERVATION : "",
      },
    ],
    mongoSessionOptions(session)
  );

  const result = { userWallet: userWalletAfter, systemWallet: await getOrCreateSystemWallet(session), transaction: created[0] };
  if (!session) {
    await reconcileUserWalletBalanceFromLedger(userId).catch(() => null);
    notifyWalletBalanceUpdated(userId, userWalletAfter, {
      transactionId: String(created[0]._id),
    });
  }
  return result;
}

/** System Wallet → Seller Wallet (giải phóng cọc). */
async function releaseDepositFromSystem(
  sellerUserId,
  amount,
  { description, reservationId, session } = {}
) {
  const creditAmount = Math.round(Number(amount));
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    return null;
  }

  const balanceBefore = await readUserWalletBalance(sellerUserId, session);
  await applySystemWalletDelta(-creditAmount, session);
  const sellerWalletAfter = await applyUserWalletDelta(sellerUserId, creditAmount, session);

  const orderCode = await createUniqueOrderCode(session);
  const created = await WalletTransaction.create(
    [
      {
        userId: sellerUserId,
        type: WALLET_TX_TYPE.DEPOSIT_RELEASE,
        amount: creditAmount,
        status: WALLET_TX_STATUS.SUCCESS,
        orderCode,
        description: description || "Giải phóng cọc giữ hàng (Reservation Release / Auto Release)",
        balanceBefore,
        balanceAfter: sellerWalletAfter.balance,
        reservationId: reservationId || null,
        referenceId: reservationId || null,
        referenceType: reservationId ? WALLET_REFERENCE_TYPE.RESERVATION : "",
      },
    ],
    mongoSessionOptions(session)
  );

  const result = { sellerWallet: sellerWalletAfter, systemWallet: await getOrCreateSystemWallet(session), transaction: created[0] };
  if (!session) {
    await reconcileUserWalletBalanceFromLedger(sellerUserId).catch(() => null);
    notifyWalletBalanceUpdated(sellerUserId, sellerWalletAfter, {
      transactionId: String(created[0]._id),
    });
  }
  return result;
}

async function loadWalletTransactionsForReservation(reservationId) {
  const id = String(reservationId || "").trim();
  if (!id || !mongoose.isValidObjectId(id)) {
    return [];
  }
  const objectId = new mongoose.Types.ObjectId(id);
  const docs = await WalletTransaction.find({
    status: WALLET_TX_STATUS.SUCCESS,
    $or: [
      { reservationId: objectId },
      {
        referenceId: objectId,
        referenceType: WALLET_REFERENCE_TYPE.RESERVATION,
      },
    ],
  })
    .sort({ CreatedAt: 1 })
    .lean();
  return docs.map((tx) => toPublicTransaction(tx));
}

module.exports = {
  getOrCreateWallet,
  getWalletBalance,
  notifyWalletBalanceUpdated,
  reconcileUserWalletBalanceFromLedger,
  getOrCreateSystemWallet,
  createUniqueOrderCode,
  createTopup,
  listTransactions,
  getTransaction,
  creditTopupFromWebhook,
  syncTopupStatus,
  cancelTopup,
  toPublicTransaction,
  debitWallet,
  creditWalletRefund,
  holdDepositToSystem,
  refundDepositFromSystem,
  releaseDepositFromSystem,
  loadWalletTransactionsForReservation,
  resolveTransactionReservationId,
};

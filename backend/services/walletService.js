const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const { getPayosClient } = require("./payosClient");
const {
  WALLET_TX_TYPE,
  WALLET_TX_STATUS,
  WALLET_TX_TYPE_LABEL,
  MIN_TOPUP_AMOUNT,
  MAX_TOPUP_AMOUNT,
} = require("../constants/wallet");

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPublicTransaction(tx) {
  return {
    id: String(tx._id),
    type: Number(tx.type),
    typeLabel: WALLET_TX_TYPE_LABEL[tx.type] || "Giao dịch",
    amount: Number(tx.amount) || 0,
    status: Number(tx.status),
    orderCode: Number(tx.orderCode) || null,
    paymentLinkId: tx.paymentLinkId || "",
    description: tx.description || "",
    balanceAfter: tx.balanceAfter == null ? null : Number(tx.balanceAfter),
    createdAt: tx.CreatedAt,
    updatedAt: tx.UpdatedAt,
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

function generateOrderCode() {
  const base = Date.now() % 1000000000;
  const rand = Math.floor(Math.random() * 900) + 100;
  return Number(`${base}${rand}`.slice(0, 15));
}

async function createUniqueOrderCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const orderCode = generateOrderCode();
    const exists = await WalletTransaction.exists({ orderCode });
    if (!exists) {
      return orderCode;
    }
  }
  throw createServiceError("Không tạo được mã giao dịch. Thử lại.", 500);
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

  const payos = getPayosClient();
  const paymentLink = await payos.paymentRequests.create({
    orderCode,
    amount,
    description: "Nap vi FastMark",
    returnUrl,
    cancelUrl,
  });

  const tx = await WalletTransaction.create({
    userId: user._id,
    type: WALLET_TX_TYPE.TOPUP,
    amount,
    status: WALLET_TX_STATUS.PENDING,
    orderCode,
    paymentLinkId: String(paymentLink.paymentLinkId || ""),
    checkoutUrl: String(paymentLink.checkoutUrl || ""),
    description: "Nạp tiền vào ví FastMark",
  });

  return {
    transaction: toPublicTransaction(tx),
    checkoutUrl: String(paymentLink.checkoutUrl || ""),
    orderCode,
    paymentLinkId: String(paymentLink.paymentLinkId || ""),
    qrCode: paymentLink.qrCode || "",
  };
}

async function listTransactions(userId, { limit = 30 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const rows = await WalletTransaction.find({ userId })
    .sort({ CreatedAt: -1 })
    .limit(safeLimit);
  return rows.map(toPublicTransaction);
}

async function getTransaction(userId, transactionId) {
  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    throw createServiceError("Giao dịch không hợp lệ.", 404);
  }
  const tx = await WalletTransaction.findOne({ _id: transactionId, userId });
  if (!tx) {
    throw createServiceError("Không tìm thấy giao dịch.", 404);
  }
  return toPublicTransaction(tx);
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
      } else if (status === "CANCELLED") {
        tx.status = WALLET_TX_STATUS.CANCELLED;
        await tx.save();
      }
    } catch {
      // Keep pending if PayOS lookup fails; client can retry.
    }
    tx = await WalletTransaction.findOne({ orderCode, userId: user._id });
  }

  const wallet = await getWalletBalance(user._id);
  return { transaction: toPublicTransaction(tx), wallet };
}

async function debitWallet(userId, amount, { description, session } = {}) {
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

  const orderCode = (Date.now() % 1000000000000) + 7;
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

module.exports = {
  getOrCreateWallet,
  getWalletBalance,
  createTopup,
  listTransactions,
  getTransaction,
  creditTopupFromWebhook,
  syncTopupStatus,
  toPublicTransaction,
  debitWallet,
  creditWalletRefund,
};

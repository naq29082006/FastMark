/**
 * Đồng bộ wallets.balance theo balanceAfter của giao dịch thành công mới nhất.
 * Usage: node backend/scripts/reconcileWalletBalances.js
 */
require("../config/env");
const connectDB = require("../config/database");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const { WALLET_TX_STATUS } = require("../constants");
const { reconcileUserWalletBalanceFromLedger } = require("../services/walletService");

async function main() {
  await connectDB();

  const userIds = await WalletTransaction.distinct("userId", {
    status: WALLET_TX_STATUS.SUCCESS,
    balanceAfter: { $ne: null },
  });

  let fixed = 0;
  let checked = 0;

  for (const userId of userIds) {
    checked += 1;
    const before = await Wallet.findOne({ userId }).lean();
    const beforeBalance = Math.max(0, Number(before?.balance) || 0);

    await reconcileUserWalletBalanceFromLedger(userId);

    const after = await Wallet.findOne({ userId }).lean();
    const afterBalance = Math.max(0, Number(after?.balance) || 0);

    if (beforeBalance !== afterBalance) {
      fixed += 1;
      console.log(
        `user ${String(userId)}: ${beforeBalance} → ${afterBalance}`
      );
    }
  }

  console.log(`Done. Checked ${checked} users, fixed ${fixed} wallet(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

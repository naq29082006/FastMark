const walletService = require("../services/walletService");
const { success, fail } = require("../utils/apiResponse");

function pickAmount(body) {
  const raw = body?.amount ?? body?.Amount ?? body?.money;
  return Number(raw);
}

exports.getWallet = async (req, res) => {
  const wallet = await walletService.getWalletBalance(req.currentUser._id);
  return success(res, { data: { wallet } });
};

exports.listTransactions = async (req, res) => {
  const limit = req.query.limit;
  const transactions = await walletService.listTransactions(req.currentUser._id, { limit });
  return success(res, { data: { transactions } });
};

exports.getTransaction = async (req, res) => {
  const transaction = await walletService.getTransaction(req.currentUser._id, req.params.id);
  return success(res, { data: { transaction } });
};

exports.createTopup = async (req, res) => {
  try {
    const result = await walletService.createTopup(req.currentUser, pickAmount(req.body));
    return success(res, {
      message: "Đã tạo liên kết thanh toán PayOS.",
      data: result,
    });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không tạo được giao dịch nạp tiền.",
    });
  }
};

exports.syncTopup = async (req, res) => {
  try {
    const orderCode = req.body.orderCode ?? req.body.order_code ?? req.query.orderCode;
    const result = await walletService.syncTopupStatus(req.currentUser, orderCode);
    return success(res, { data: result });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 500,
      message: error.message || "Không đồng bộ được giao dịch.",
    });
  }
};

exports.payosWebhook = async (req, res) => {
  try {
    const result = await walletService.creditTopupFromWebhook(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Webhook PayOS thất bại.",
    });
  }
};

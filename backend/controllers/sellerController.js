const sellerService = require("../services/sellerService");
const userService = require("../services/userService");
const { success, fail } = require("../utils/apiResponse");

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }

  return "";
}

exports.requestPhoneCode = async (req, res) => {
  const phone = pickBodyValue(req.body, ["phone", "Phone"]);
  if (!phone) {
    return fail(res, {
      status: 400,
      message: "Thiếu số điện thoại.",
    });
  }

  try {
    const verification = await sellerService.requestSellerPhoneCode(req.currentUser, phone);
    return success(res, {
      message: "Đã tạo mã xác minh số điện thoại.",
      data: verification,
    });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 400,
      message: error.message || "Không gửi được mã xác minh.",
      data: error.data || undefined,
    });
  }
};

exports.confirmPhoneCode = async (req, res) => {
  const code = pickBodyValue(req.body, ["code", "verificationCode"]);
  const phone = pickBodyValue(req.body, ["phone", "Phone"]);

  if (!phone) {
    return fail(res, {
      status: 400,
      message: "Thiếu số điện thoại.",
    });
  }

  if (!code) {
    return fail(res, {
      status: 400,
      message: "Thiếu mã xác minh.",
    });
  }

  try {
    const result = await sellerService.confirmSellerPhoneCode(req.currentUser, code, phone);
    return success(res, {
      message: "Xác minh số điện thoại thành công.",
      data: {
        ...result,
        sellerPhoneVerified: true,
      },
    });
  } catch (error) {
    return fail(res, {
      status: error.statusCode || 400,
      message: error.message || "Xác minh thất bại.",
      data: error.data || undefined,
    });
  }
};

exports.getMyVerification = async (req, res) => {
  const verification = await sellerService.syncSellerRoleFromVerification(req.currentUser);
  const user = await userService.findUserByFirebaseUid(req.currentUser.FirebaseUID);

  return success(res, {
    data: {
      verification: sellerService.toPublicVerification(verification),
      sellerPhoneVerified: Boolean(user?.SellerPhoneVerified),
      hasPhone: Boolean(String(user?.Phone || "").trim()),
      role: user?.Role ?? req.currentUser.Role,
    },
  });
};

exports.submitVerification = async (req, res) => {
  const verification = await sellerService.submitSellerVerification(
    req.currentUser,
    sellerService.normalizeSellerRegistrationPayload(req.body)
  );
  const user = await userService.findUserByFirebaseUid(req.currentUser.FirebaseUID);

  let publicVerification = null;
  try {
    publicVerification = sellerService.toPublicVerification(verification);
  } catch (serializationError) {
    console.error("[seller] submitVerification serialize failed", serializationError);
    publicVerification = {
      id: verification?._id,
      status: verification?.status,
    };
  }

  return success(res, {
    message: "Đã gửi hồ sơ đăng ký người bán. Vui lòng chờ admin duyệt.",
    data: {
      verification: publicVerification,
      role: user?.Role ?? req.currentUser.Role,
    },
  });
};

exports.listPendingVerifications = async (req, res) => {
  const verifications = await sellerService.listPendingSellerVerifications();

  return success(res, {
    data: {
      verifications: verifications.map(sellerService.toAdminVerification),
    },
  });
};

exports.approveVerification = async (req, res) => {
  const verification = await sellerService.approveSellerVerificationByAdmin(
    req.currentUser,
    req.params.id
  );

  return success(res, {
    message: "Đã duyệt hồ sơ người bán.",
    data: {
      verification: sellerService.toPublicVerification(verification),
    },
  });
};

exports.rejectVerification = async (req, res) => {
  const reason = pickBodyValue(req.body, ["lyDoTuChoi", "reason", "rejectReason"]);

  if (!reason) {
    return fail(res, {
      status: 400,
      message: "Vui lòng nhập lý do từ chối.",
    });
  }

  const verification = await sellerService.rejectSellerVerificationByAdmin(
    req.currentUser,
    req.params.id,
    reason
  );

  return success(res, {
    message: "Đã từ chối hồ sơ người bán.",
    data: {
      verification: sellerService.toPublicVerification(verification),
    },
  });
};

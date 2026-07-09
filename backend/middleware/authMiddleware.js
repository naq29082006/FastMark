const { getUserFromToken } = require("../services/authService");
const { mapFirebaseAdminError } = require("../utils/firebaseErrors");

async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Thiếu Bearer token trong header Authorization.",
    });
  }

  try {
    req.firebaseToken = token;
    req.currentUser = await getUserFromToken(token);
    next();
  } catch (error) {
    const mapped = error.statusCode ? error : mapFirebaseAdminError(error);

    return res.status(mapped.statusCode || 401).json({
      success: false,
      message: mapped.message,
    });
  }
}

module.exports = verifyFirebaseToken;

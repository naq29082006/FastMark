/**
 * Xuất danh sách API FastMark ra file Excel.
 * Chạy: node backend/scripts/exportApiExcel.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ROUTES_DIR = path.join(ROOT, "routes");
const OUTPUT = path.resolve(ROOT, "..", "docs", "FastMark-API-Danh-Sach.xlsx");

const ROUTE_MOUNTS = {
  "authRoutes.js": "/api/auth",
  "sellerRoutes.js": "/api/seller",
  "buyerRoutes.js": "/api/buyer",
  "productRoutes.js": "/api/products",
  "categoryRoutes.js": "/api/categories",
  "adminRoutes.js": "/api/admin",
  "notificationRoutes.js": "/api/notifications",
  "walletRoutes.js": "/api/wallet",
  "bannerRoutes.js": "/api/banners",
  "reportRoutes.js": "/api/reports",
  "storeRoutes.js": "/api",
};

const APP_ROUTES = [
  { method: "GET", path: "/", auth: "Không", desc: "Thông tin service API", params: "—", result: '{ "ok": true, "service": "Fastmark API", "mongo": "connected", "firebaseProject": "..." }' },
  { method: "GET", path: "/health", auth: "Không", desc: "Health check", params: "—", result: '{ "success": true, "message": "OK" }' },
  { method: "POST", path: "/api/webhooks/payos", auth: "PayOS webhook signature", desc: "Webhook PayOS xác nhận nạp tiền", params: "Body: PayOS callback payload", result: '{ "success": true }' },
];

const HANDLER_META = {
  registerEmail: { desc: "Đăng ký tài khoản email", params: "Body: { email, password, fullName, userName }", result: '{ "success": true, "message": "Đăng ký email thành công.", "data": { "customToken", "user" } }' },
  checkRegisterAvailability: { desc: "Kiểm tra email/username còn trống", params: "Body: { email?, userName? }", result: '{ "success": true, "data": { "emailTaken", "userNameTaken" } }' },
  loginEmail: { desc: "Đăng nhập email", params: "Body: { email|userName, password }", result: '{ "success": true, "message": "Đăng nhập email thành công.", "data": { "customToken", "user" } }' },
  registerOrLoginGoogle: { desc: "Đăng ký/đăng nhập Google", params: "Body: { idToken, userName?, fullName? }", result: '{ "success": true, "data": { "customToken", "user" } }' },
  requestPasswordReset: { desc: "Yêu cầu OTP quên mật khẩu", params: "Body: { email }", result: '{ "success": true, "message": "..." }' },
  verifyPasswordResetOtp: { desc: "Xác minh OTP quên mật khẩu", params: "Body: { email, otp }", result: '{ "success": true, "data": { "resetToken" } }' },
  resetPassword: { desc: "Đặt lại mật khẩu", params: "Body: { resetToken, newPassword }", result: '{ "success": true }' },
  requestEmailVerification: { desc: "Gửi OTP xác minh email", params: "Header: Bearer token (User)", result: '{ "success": true }' },
  confirmEmailVerification: { desc: "Xác nhận OTP email", params: "Header: Bearer token (User); Body: { otp }", result: '{ "success": true }' },
  getMe: { desc: "Lấy thông tin tài khoản hiện tại", params: "Header: Bearer token (User, cho phép bị khóa)", result: '{ "success": true, "data": { "user", "shop?", "wallet?" } }' },
  updateMe: { desc: "Cập nhật hồ sơ cá nhân", params: "Header: Bearer token (User); Body: { fullName?, phone?, ... }", result: '{ "success": true, "data": { "user" } }' },
  getLockAppealStatus: { desc: "Trạng thái khiếu nại khóa tài khoản", params: "Header: Bearer token (User bị khóa)", result: '{ "success": true, "data": { "appeal" } }' },
  createLockAppeal: { desc: "Gửi khiếu nại khóa tài khoản", params: "Header: Bearer token; Body: { content, images? }", result: '{ "success": true, "data": { "report" } }' },
  getShopLockAppealStatus: { desc: "Trạng thái khiếu nại khóa shop", params: "Header: Bearer token (User)", result: '{ "success": true, "data": { "appeal" } }' },
  createShopLockAppeal: { desc: "Gửi khiếu nại khóa shop", params: "Header: Bearer token; Body: { content, images? }", result: '{ "success": true }' },
  uploadAvatar: { desc: "Upload avatar người dùng", params: "Header: Bearer token; multipart: avatar hoặc Body JSON { avatarUrl }", result: '{ "success": true, "data": { "avatar" } }' },
  setPresenceOnline: { desc: "Bật trạng thái online user", params: "Header: Bearer token (User)", result: '{ "success": true }' },
  setPresenceOffline: { desc: "Tắt trạng thái online user", params: "Header: Bearer token (User)", result: '{ "success": true }' },
  setShopPresenceOnline: { desc: "Bật trạng thái online shop", params: "Header: Bearer token (Seller)", result: '{ "success": true }' },
  setShopPresenceOffline: { desc: "Tắt trạng thái online shop", params: "Header: Bearer token (Seller)", result: '{ "success": true }' },
  listNearbyShops: { desc: "Danh sách shop gần vị trí", params: "Query: lat, lng, radius?, limit?", result: '{ "success": true, "data": { "items": [...] } }' },
  searchShops: { desc: "Tìm kiếm shop", params: "Query: q, page?, limit?", result: '{ "success": true, "data": { "items", "total" } }' },
  listShopCategories: { desc: "Danh mục shop (public)", params: "—", result: '{ "success": true, "data": [...] }' },
  getShop: { desc: "Chi tiết shop public", params: "Path: :id", result: '{ "success": true, "data": { "shop" } }' },
  listShopProducts: { desc: "Sản phẩm của shop", params: "Path: :id; Query: page?, limit?", result: '{ "success": true, "data": { "items" } }' },
  listShopPromotions: { desc: "Khuyến mãi shop", params: "Path: :id", result: '{ "success": true, "data": [...] }' },
  listShopReviews: { desc: "Đánh giá shop", params: "Path: :id; Query: page?", result: '{ "success": true, "data": { "items" } }' },
  listCategories: { desc: "Danh mục sản phẩm public", params: "—", result: '{ "success": true, "data": [...] }' },
  discoverProducts: { desc: "Khám phá sản phẩm", params: "Query: q?, categoryId?, lat?, lng?", result: '{ "success": true, "data": { "items" } }' },
  listPromotions: { desc: "Sản phẩm khuyến mãi", params: "Query: page?, limit?", result: '{ "success": true, "data": { "items" } }' },
  getProduct: { desc: "Chi tiết sản phẩm", params: "Path: :id", result: '{ "success": true, "data": { "product" } }' },
  listActive: { desc: "Banner đang hiển thị", params: "—", result: '{ "success": true, "data": [...] }' },
  recordClick: { desc: "Ghi nhận click banner", params: "Path: :id", result: '{ "success": true }' },
  getWallet: { desc: "Số dư ví", params: "Header: Bearer token (User)", result: '{ "success": true, "data": { "balance" } }' },
  listTransactions: { desc: "Lịch sử giao dịch ví", params: "Header: Bearer token; Query: page?, limit?", result: '{ "success": true, "data": { "items" } }' },
  getTransaction: { desc: "Chi tiết giao dịch ví", params: "Header: Bearer token; Path: :id", result: '{ "success": true, "data": { "transaction" } }' },
  createTopup: { desc: "Tạo link nạp tiền PayOS", params: "Header: Bearer token; Body: { amount }", result: '{ "success": true, "data": { "checkoutUrl", "orderCode" } }' },
  syncTopup: { desc: "Đồng bộ trạng thái nạp tiền", params: "Header: Bearer token; Body: { orderCode }", result: '{ "success": true, "data": { "wallet", "transaction" } }' },
  cancelTopup: { desc: "Hủy phiên nạp tiền", params: "Header: Bearer token; Body: { orderCode }", result: '{ "success": true }' },
  payosWebhook: { desc: "Webhook PayOS", params: "Body: PayOS payload", result: '{ "success": true }' },
  listMyNotifications: { desc: "Danh sách thông báo", params: "Header: Bearer token (User); Query: page?, limit?, audience?=buyer|seller", result: '{ "success": true, "data": { "items", "unreadCount", "pagination" } }' },
  getUnreadCount: { desc: "Số thông báo chưa đọc theo audience", params: "Header: Bearer token (User); Query: audience?=buyer|seller", result: '{ "success": true, "data": { "unreadCount", "audience" } }' },
  markAllAsRead: { desc: "Đánh dấu đọc tất cả thông báo", params: "Header: Bearer token (User); Query/Body: audience?", result: '{ "success": true }' },
  registerDeviceToken: { desc: "Đăng ký FCM device token", params: "Header: Bearer token; Body: { token, platform? }", result: '{ "success": true }' },
  removeDeviceToken: { desc: "Xóa FCM device token", params: "Header: Bearer token; Body: { token }", result: '{ "success": true }' },
  markAsRead: { desc: "Đánh dấu đọc 1 thông báo", params: "Header: Bearer token; Path: :id; Query: audience?", result: '{ "success": true, "data": { "unreadCount?", "unreadCounts?" } }' },
};

function resolveAuth(block) {
  const parts = [];
  if (/verifyFirebaseTokenAllowBlocked/.test(block)) {
    parts.push("Bearer token (User, kể cả bị khóa)");
  } else if (/verifyFirebaseToken/.test(block)) {
    parts.push("Bearer token (User)");
  }
  if (/requireAdmin/.test(block)) parts.push("Quyền Admin");
  if (/requireSeller/.test(block)) parts.push("Quyền Seller");
  if (!parts.length) return "Không cần token";
  return parts.join(" + ");
}

function extractHandlerName(block) {
  const match = block.match(/(?:Controller|controller)\.(\w+)/);
  return match ? match[1] : "";
}

function parseRouteFile(fileName) {
  const mount = ROUTE_MOUNTS[fileName];
  if (!mount) return [];
  const content = fs.readFileSync(path.join(ROUTES_DIR, fileName), "utf8");
  const routes = [];
  const regex = /router\.(get|post|put|patch|delete)\s*\(\s*(?:[\s\S]*?)\);/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const block = match[0];
    const method = match[1].toUpperCase();
    const pathMatch = block.match(/router\.\w+\s*\(\s*["'`]([^"'`]+)["'`]/);
    if (!pathMatch) continue;
    const routePath = pathMatch[1];
    const handler = extractHandlerName(block);
    const auth = resolveAuth(block);
    const meta = HANDLER_META[handler] || {};
    const fullPath = `${mount}${routePath.startsWith("/") ? routePath : `/${routePath}`}`.replace(/\/+/g, "/");

    routes.push({
      method,
      path: fullPath,
      auth: meta.auth || auth,
      desc: meta.desc || humanizeHandler(handler, routePath),
      params: meta.params || buildDefaultParams(method, routePath, auth),
      result: meta.result || '{ "success": true, "message": "Success", "data": {...} }',
      handler,
      source: fileName,
    });
  }
  return routes;
}

function humanizeHandler(handler, routePath) {
  if (!handler) return `API ${routePath}`;
  return handler
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function buildDefaultParams(method, routePath, auth) {
  const bits = [];
  if (auth !== "Không cần token") bits.push(`Header: ${auth}`);
  if (routePath.includes(":")) bits.push(`Path: ${routePath.match(/:\w+/g)?.join(", ") || ""}`);
  if (method === "GET") bits.push("Query: page?, limit?, q?, ...");
  else bits.push("Body: JSON theo controller");
  return bits.filter(Boolean).join("; ");
}

function enrichRoutes(routes) {
  const extras = {
    requestPhoneCode: { desc: "Gửi OTP xác minh SĐT seller", params: "Header: Bearer token; Body: { phone }", result: '{ "success": true }' },
    confirmPhoneCode: { desc: "Xác nhận OTP SĐT seller", params: "Header: Bearer token; Body: { phone, code }", result: '{ "success": true }' },
    getMyVerification: { desc: "Trạng thái xác minh seller", params: "Header: Bearer token (User)", result: '{ "success": true, "data": { "verification" } }' },
    submitVerification: { desc: "Nộp hồ sơ xác minh seller", params: "Header: Bearer token; Body: { shopName, documents, ... }", result: '{ "success": true }' },
    checkShopUsernameAvailability: { desc: "Kiểm tra username shop", params: "Header: Bearer token; Body: { userName }", result: '{ "success": true, "data": { "available" } }' },
    listPendingVerifications: { desc: "Admin: hồ sơ seller chờ duyệt", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": { "items" } }' },
    listAdminVerifications: { desc: "Admin: tất cả hồ sơ seller", params: "Header: Bearer token (Admin); Query: status?", result: '{ "success": true, "data": { "items" } }' },
    approveVerification: { desc: "Admin duyệt seller", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    rejectVerification: { desc: "Admin từ chối seller", params: "Header: Bearer token (Admin); Path: :id; Body: { note? }", result: '{ "success": true }' },
    getShopSettings: { desc: "Cài đặt shop seller", params: "Header: Bearer token (Seller)", result: '{ "success": true, "data": { "shop" } }' },
    updateShopSettings: { desc: "Cập nhật shop seller", params: "Header: Bearer token (Seller); Body: shop fields", result: '{ "success": true, "data": { "shop" } }' },
    uploadShopAvatar: { desc: "Upload avatar shop", params: "Header: Bearer token (Seller); multipart avatar", result: '{ "success": true, "data": { "avatar" } }' },
    listOrders: { desc: "Danh sách đơn (buyer/seller)", params: "Header: Bearer token; Query: tab?, search?", result: '{ "success": true, "data": { "items" } }' },
    getReservationDetail: { desc: "Chi tiết đơn giữ hàng", params: "Header: Bearer token; Path: :id", result: '{ "success": true, "data": { "reservation" } }' },
    confirmReservation: { desc: "Seller xác nhận giữ hàng", params: "Header: Bearer token (Seller); Path: :id", result: '{ "success": true, "data": { "reservation" } }' },
    rejectReservation: { desc: "Seller từ chối giữ hàng", params: "Header: Bearer token (Seller); Path: :id; Body: { reason? }", result: '{ "success": true, "data": { "reservation" } }' },
    cancelReservation: { desc: "Hủy đơn giữ hàng", params: "Header: Bearer token; Path: :id; Body: { reason?, images? }", result: '{ "success": true, "data": { "reservation" } }' },
    refundDisputeDeposit: { desc: "Seller hoàn cọc tranh chấp", params: "Header: Bearer token (Seller); Path: :id", result: '{ "success": true }' },
    getStats: { desc: "Thống kê seller", params: "Header: Bearer token (Seller)", result: '{ "success": true, "data": { "stats" } }' },
    getSubscription: { desc: "Gói đăng ký seller hiện tại", params: "Header: Bearer token (Seller)", result: '{ "success": true, "data": { "subscription" } }' },
    purchaseSubscription: { desc: "Mua gói seller", params: "Header: Bearer token (Seller); Body: { planId }", result: '{ "success": true }' },
    getMyBanner: { desc: "Banner quảng cáo của seller", params: "Header: Bearer token (Seller)", result: '{ "success": true, "data": { "banner" } }' },
    purchaseBanner: { desc: "Mua banner quảng cáo", params: "Header: Bearer token (Seller); Body: { planId }", result: '{ "success": true }' },
    updateCreative: { desc: "Cập nhật nội dung banner", params: "Header: Bearer token (Seller); Body: { imageUrl, link? }", result: '{ "success": true }' },
    listReviews: { desc: "Danh sách đánh giá", params: "Header: Bearer token; Query: page?", result: '{ "success": true, "data": { "items" } }' },
    createReview: { desc: "Tạo đánh giá", params: "Header: Bearer token; Body: { reservationId, rating, content }", result: '{ "success": true, "data": { "review" } }' },
    updateReview: { desc: "Sửa đánh giá", params: "Header: Bearer token; Path: :id; Body: fields", result: '{ "success": true }' },
    deleteReview: { desc: "Xóa đánh giá", params: "Header: Bearer token; Path: :id", result: '{ "success": true }' },
    createReport: { desc: "Buyer báo cáo vi phạm", params: "Header: Bearer token; Body: { reportType, content, ... }", result: '{ "success": true }' },
    listFavorites: { desc: "Sản phẩm yêu thích", params: "Header: Bearer token; Query: page?", result: '{ "success": true, "data": { "items" } }' },
    listFavoriteIds: { desc: "ID sản phẩm yêu thích", params: "Header: Bearer token", result: '{ "success": true, "data": { "ids" } }' },
    addFavorite: { desc: "Thêm yêu thích", params: "Header: Bearer token; Body: { productId }", result: '{ "success": true }' },
    removeFavorite: { desc: "Bỏ yêu thích", params: "Header: Bearer token; Path: :productId", result: '{ "success": true }' },
    getFollowStatus: { desc: "Trạng thái follow shop", params: "Header: Bearer token; Query: shopId", result: '{ "success": true, "data": { "following" } }' },
    listFollowing: { desc: "Shop đang theo dõi", params: "Header: Bearer token", result: '{ "success": true, "data": { "items" } }' },
    listFollowers: { desc: "Người theo dõi shop/user", params: "Header: Bearer token", result: '{ "success": true, "data": { "items" } }' },
    followShop: { desc: "Theo dõi shop", params: "Header: Bearer token; Body: { shopId }", result: '{ "success": true }' },
    unfollowShop: { desc: "Bỏ theo dõi shop", params: "Header: Bearer token; Path: :targetId hoặc Body: { shopId }", result: '{ "success": true }' },
    searchUsers: { desc: "Tìm user", params: "Header: Bearer token; Query: q", result: '{ "success": true, "data": { "items" } }' },
    getPublicUserFollowing: { desc: "Shop user đang theo dõi", params: "Header: Bearer token; Path: :userId", result: '{ "success": true, "data": { "items" } }' },
    getPublicUserProfile: { desc: "Hồ sơ user public", params: "Header: Bearer token; Path: :userId", result: '{ "success": true, "data": { "user" } }' },
    createReservation: { desc: "Tạo đơn giữ hàng", params: "Header: Bearer token; Body: { productId, variantId, quantity, pickupTime, note? }", result: '{ "success": true, "data": { "reservation" } }' },
    confirmReceived: { desc: "Buyer xác nhận đã nhận hàng (QR)", params: "Header: Bearer token; Body: { reservationId, scannedShopId }", result: '{ "success": true, "data": { "reservation" } }' },
    validateShopQrScan: { desc: "Kiểm tra QR shop hợp lệ", params: "Header: Bearer token; Body: { reservationId, scannedShopId }", result: '{ "success": true, "data": { "ok": true } }' },
    reportReservation: { desc: "Buyer báo cáo tranh chấp đơn", params: "Header: Bearer token; Body: { reason, description, latitude, longitude, images }", result: '{ "success": true, "data": { "report", "reservation" } }' },
    getReservation: { desc: "Chi tiết đơn buyer", params: "Header: Bearer token; Path: :id", result: '{ "success": true, "data": { "reservation" } }' },
    forfeitDeposit: { desc: "Buyer đồng ý mất cọc", params: "Header: Bearer token; Body/Path: reservationId", result: '{ "success": true, "data": { "reservation" } }' },
    listMyProducts: { desc: "Sản phẩm của seller", params: "Header: Bearer token (Seller); Query: page?", result: '{ "success": true, "data": { "items" } }' },
    getMyProduct: { desc: "Chi tiết SP seller", params: "Header: Bearer token (Seller); Path: :id", result: '{ "success": true, "data": { "product" } }' },
    createProduct: { desc: "Tạo sản phẩm", params: "Header: Bearer token (Seller); Body: product data", result: '{ "success": true, "data": { "product" } }' },
    updateProduct: { desc: "Cập nhật sản phẩm", params: "Header: Bearer token (Seller); Path: :id", result: '{ "success": true }' },
    setPromotion: { desc: "Đặt khuyến mãi SP", params: "Header: Bearer token (Seller); Path: :id; Body: { discountPercent, ... }", result: '{ "success": true }' },
    clearPromotion: { desc: "Xóa khuyến mãi SP", params: "Header: Bearer token (Seller); Path: :id", result: '{ "success": true }' },
    bulkSetPromotions: { desc: "Khuyến mãi hàng loạt", params: "Header: Bearer token (Seller); Body: { items }", result: '{ "success": true }' },
    listMyPromotions: { desc: "KM của seller", params: "Header: Bearer token (Seller)", result: '{ "success": true, "data": [...] }' },
    setProductPin: { desc: "Ghim sản phẩm", params: "Header: Bearer token (Seller); Path: :id; Body: { pinned }", result: '{ "success": true }' },
    softDeleteProduct: { desc: "Xóa mềm sản phẩm", params: "Header: Bearer token (Seller); Path: :id", result: '{ "success": true }' },
    buyerReportSeller: { desc: "Buyer báo seller không có mặt", params: "Header: Bearer token; Body: { reservationId, reason, description, lat, lng, images }", result: '{ "success": true, "data": { "report" } }' },
    sellerReportBuyer: { desc: "Seller báo buyer không đến", params: "Header: Bearer token (Seller); Body: { reservationId, description, lat, lng, images }", result: '{ "success": true, "data": { "report" } }' },
    listReservationReports: { desc: "Báo cáo tranh chấp của đơn", params: "Header: Bearer token; Path: reservationId", result: '{ "success": true, "data": { "reports" } }' },
    listActiveBanks: { desc: "Ngân hàng hỗ trợ rút tiền", params: "Header: Bearer token", result: '{ "success": true, "data": [...] }' },
    listMyWithdraws: { desc: "Lịch sử rút tiền", params: "Header: Bearer token", result: '{ "success": true, "data": [...] }' },
    createWithdraw: { desc: "Tạo yêu cầu rút tiền", params: "Header: Bearer token; Body: { amount, bankId, accountNumber, accountName }", result: '{ "success": true, "data": { "withdraw", "wallet" } }' },
    getDashboard: { desc: "Dashboard admin", params: "Header: Bearer token (Admin); Query: from?, to?", result: '{ "success": true, "data": { "stats", "charts" } }' },
    listAccounts: { desc: "Danh sách tài khoản", params: "Header: Bearer token (Admin); Query: q?, page?", result: '{ "success": true, "data": { "items", "total" } }' },
    getAccountDetail: { desc: "Chi tiết tài khoản admin", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "account" } }' },
    getAccountHistory: { desc: "Lịch sử tài khoản", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "items" } }' },
    getAccountFinance: { desc: "Tài chính tài khoản", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "wallet", "transactions" } }' },
    listAccountFollowing: { desc: "Shop user đang follow", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "items" } }' },
    listAccountFollowers: { desc: "Follower của user", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "items" } }' },
    getFinanceOverview: { desc: "Tổng quan tài chính admin", params: "Header: Bearer token (Admin); Query: from?, to?", result: '{ "success": true, "data": {...} }' },
    listAuditLogs: { desc: "Nhật ký audit admin", params: "Header: Bearer token (Admin); Query: page?", result: '{ "success": true, "data": { "items" } }' },
    blockAccount: { desc: "Khóa tài khoản", params: "Header: Bearer token (Admin); Path: :id; Body: { reason? }", result: '{ "success": true }' },
    unblockAccount: { desc: "Mở khóa tài khoản", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    listShops: { desc: "Danh sách shop admin", params: "Header: Bearer token (Admin); Query: q?, page?", result: '{ "success": true, "data": { "items" } }' },
    getShopDetail: { desc: "Chi tiết shop admin", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "shop" } }' },
    getShopHistory: { desc: "Lịch sử shop", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "items" } }' },
    listShopFollowing: { desc: "Following của shop", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "items" } }' },
    listShopFollowers: { desc: "Follower shop", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "items" } }' },
    blockShop: { desc: "Khóa shop", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    unblockShop: { desc: "Mở khóa shop", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    deleteShop: { desc: "Xóa shop", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    listProducts: { desc: "Danh sách SP admin", params: "Header: Bearer token (Admin); Query: q?", result: '{ "success": true, "data": { "items" } }' },
    getProductDetail: { desc: "Chi tiết SP admin", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "product" } }' },
    hideProduct: { desc: "Ẩn sản phẩm", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    showProduct: { desc: "Hiện sản phẩm", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    deleteProduct: { desc: "Xóa sản phẩm admin", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    listReservations: { desc: "Danh sách đơn giữ hàng", params: "Header: Bearer token (Admin); Query: tab?, q?, page?", result: '{ "success": true, "data": { "items", "total" } }' },
    listDisputes: { desc: "Đơn tranh chấp", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": { "items" } }' },
    getReservationStats: { desc: "Thống kê đơn hàng", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": { "stats" } }' },
    refundToBuyer: { desc: "Admin hoàn cọc buyer (tranh chấp)", params: "Header: Bearer token (Admin); Path: :id; Body: { note } (bắt buộc)", result: '{ "success": true, "data": { "reservation" } }' },
    releaseToSeller: { desc: "Admin chuyển cọc seller", params: "Header: Bearer token (Admin); Path: :id; Body: { note } (bắt buộc)", result: '{ "success": true, "data": { "reservation" } }' },
    listReports: { desc: "Danh sách báo cáo", params: "Header: Bearer token (Admin); Query: status?, type?", result: '{ "success": true, "data": { "items" } }' },
    getReportDetail: { desc: "Chi tiết báo cáo", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true, "data": { "report" } }' },
    dismissReport: { desc: "Bác bỏ báo cáo", params: "Header: Bearer token (Admin); Path: :id; Body: { note }", result: '{ "success": true }' },
    approveReport: { desc: "Duyệt báo cáo", params: "Header: Bearer token (Admin); Path: :id; Body: { note }", result: '{ "success": true }' },
    approveBuyer: { desc: "Tranh chấp: hoàn cọc buyer", params: "Header: Bearer token (Admin); Path: :id; Body: { note? }", result: '{ "success": true }' },
    approveSeller: { desc: "Tranh chấp: chuyển cọc seller", params: "Header: Bearer token (Admin); Path: :id; Body: { note? }", result: '{ "success": true }' },
    rejectReservationReport: { desc: "Bác báo cáo tranh chấp đơn", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    hideReview: { desc: "Ẩn đánh giá", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    showReview: { desc: "Hiện đánh giá", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    sendSystemNotification: { desc: "Gửi thông báo hệ thống", params: "Header: Bearer token (Admin); Body: { title, content, audience }", result: '{ "success": true }' },
    listBroadcastHistory: { desc: "Lịch sử broadcast", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": { "items" } }' },
    listAdminPlans: { desc: "Gói seller/banner admin", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": [...] }' },
    createPlan: { desc: "Tạo gói seller/banner", params: "Header: Bearer token (Admin); Body: plan fields", result: '{ "success": true }' },
    updatePlan: { desc: "Sửa gói", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    removePlan: { desc: "Xóa gói", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    listSubscriptions: { desc: "Đăng ký gói seller", params: "Header: Bearer token (Admin); Query: page?", result: '{ "success": true, "data": { "items" } }' },
    listSellerBanners: { desc: "Banner seller chờ duyệt", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": { "items" } }' },
    approveSellerBanner: { desc: "Duyệt banner seller", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    rejectSellerBanner: { desc: "Từ chối banner", params: "Header: Bearer token (Admin); Path: :id; Body: { note? }", result: '{ "success": true }' },
    cancelSellerBanner: { desc: "Hủy banner", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    listBanks: { desc: "Quản lý ngân hàng", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": [...] }' },
    createBank: { desc: "Thêm ngân hàng", params: "Header: Bearer token (Admin); Body: { name, code }", result: '{ "success": true }' },
    updateBank: { desc: "Sửa ngân hàng", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    deleteBank: { desc: "Xóa ngân hàng", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    listAdminWithdraws: { desc: "Yêu cầu rút tiền", params: "Header: Bearer token (Admin); Query: status?", result: '{ "success": true, "data": { "items" } }' },
    approveWithdraw: { desc: "Duyệt rút tiền", params: "Header: Bearer token (Admin); Path: :id; Body: { adminNote? }", result: '{ "success": true }' },
    rejectWithdraw: { desc: "Từ chối rút tiền", params: "Header: Bearer token (Admin); Path: :id; Body: { adminNote? }", result: '{ "success": true }' },
    listProductCategories: { desc: "DM SP admin", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": [...] }' },
    createProductCategory: { desc: "Tạo DM SP", params: "Header: Bearer token (Admin); Body: { name }", result: '{ "success": true }' },
    updateProductCategory: { desc: "Sửa DM SP", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    deleteProductCategory: { desc: "Xóa DM SP", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    uploadShopCategoryIcon: { desc: "Upload icon DM shop", params: "Header: Bearer token (Admin); multipart icon", result: '{ "success": true }' },
    listShopCategories: { desc: "DM shop admin", params: "Header: Bearer token (Admin)", result: '{ "success": true, "data": [...] }' },
    createShopCategory: { desc: "Tạo DM shop", params: "Header: Bearer token (Admin)", result: '{ "success": true }' },
    updateShopCategory: { desc: "Sửa DM shop", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    deleteShopCategory: { desc: "Xóa DM shop", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    createCategory: { desc: "Tạo DM (legacy)", params: "Header: Bearer token (Admin)", result: '{ "success": true }' },
    updateCategory: { desc: "Sửa DM (legacy)", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
    deleteCategory: { desc: "Xóa DM (legacy)", params: "Header: Bearer token (Admin); Path: :id", result: '{ "success": true }' },
  };

  return routes.map((route) => {
    const extra = extras[route.handler];
    if (!extra) return route;
    return {
      ...route,
      desc: extra.desc || route.desc,
      params: extra.params || route.params,
      result: extra.result || route.result,
    };
  });
}

function collectAllRoutes() {
  let all = [...APP_ROUTES];
  for (const fileName of Object.keys(ROUTE_MOUNTS)) {
    all = all.concat(parseRouteFile(fileName));
  }
  all = enrichRoutes(all);
  const seen = new Set();
  all = all.filter((row) => {
    const key = `${row.method} ${row.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  all.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return all;
}

function writeExcel(rows) {
  let XLSX;
  try {
    XLSX = require("xlsx");
  } catch {
    console.error("Thiếu package xlsx. Chạy: npm install xlsx --prefix backend");
    process.exit(1);
  }

  const header = ["STT", "Phương thức", "URL", "Mô tả", "Tham số đầu vào", "Kết quả (success)"];
  const data = [header];
  rows.forEach((row, index) => {
    data.push([
      index + 1,
      row.method,
      row.path,
      row.desc,
      row.params,
      row.result,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 48 },
    { wch: 36 },
    { wch: 52 },
    { wch: 56 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FastMark API");

  const webWs = buildWebClientSheet(XLSX);
  XLSX.utils.book_append_sheet(wb, webWs, "Web Admin Client");

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  XLSX.writeFile(wb, OUTPUT);
  console.log(`Đã xuất ${rows.length} API → ${OUTPUT}`);
}

function buildWebClientSheet(XLSX) {
  const webCalls = scanWebApiFiles();
  const header = ["STT", "File web", "Phương thức", "URL", "Token", "Ghi chú"];
  const data = [header];
  webCalls.forEach((call, index) => {
    data.push([
      index + 1,
      call.file,
      call.method,
      call.path,
      call.token,
      call.note,
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 50 }, { wch: 24 }, { wch: 30 }];
  return ws;
}

function scanWebApiFiles() {
  const webApiDir = path.resolve(ROOT, "..", "web", "src", "api");
  const files = fs.readdirSync(webApiDir).filter((f) => f.endsWith(".js") && f !== "client.js");
  const calls = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(webApiDir, file), "utf8");
    const regex = /apiRequest\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const snippet = content.slice(match.index, match.index + 200);
      const methodMatch = snippet.match(/method:\s*['"](\w+)['"]/i);
      calls.push({
        file,
        method: (methodMatch ? methodMatch[1] : "GET").toUpperCase(),
        path: match[1].split("${")[0].replace(/\?.*$/, ""),
        token: "Bearer token (Admin)",
        note: "Gọi từ trang admin web",
      });
    }
    const templateRegex = /apiRequest\s*\(\s*`([^`]+)`/g;
    while ((match = templateRegex.exec(content)) !== null) {
      if (match[1].includes("${")) {
        const base = match[1].replace(/\$\{[^}]+\}/g, ":id");
        calls.push({
          file,
          method: "GET/POST",
          path: base,
          token: "Bearer token (Admin)",
          note: "URL động — xem file web",
        });
      }
    }
  }
  return calls;
}

const routes = collectAllRoutes();
writeExcel(routes);

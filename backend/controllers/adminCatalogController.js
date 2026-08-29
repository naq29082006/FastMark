const adminCatalogService = require("../services/adminCatalogService");
const { SHOP_STATUS } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const { success } = require("../utils/apiResponse");

function pickQueryValue(query, keys) {
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function pickBodyValue(body, keys) {
  for (const key of keys) {
    if (body?.[key] !== undefined && body?.[key] !== null && String(body[key]).trim() !== "") {
      return String(body[key]).trim();
    }
  }
  return "";
}

function pickDateRangeQuery(query) {
  return {
    from: pickQueryValue(query, ["from", "dateFrom"]),
    to: pickQueryValue(query, ["to", "dateTo"]),
  };
}

exports.listShops = async (req, res) => {
  const data = await adminCatalogService.listShops({
    search: pickQueryValue(req.query, ["search", "q"]),
    status: pickQueryValue(req.query, ["status"]),
    isOpen: pickQueryValue(req.query, ["isOpen", "open"]),
    categoryId: pickQueryValue(req.query, ["categoryId"]),
    page: req.query.page,
    limit: req.query.limit,
    ...pickDateRangeQuery(req.query),
  });
  return success(res, { data });
};

exports.getShopDetail = async (req, res) => {
  const shop = await adminCatalogService.getShopDetail(req.params.id);
  return success(res, { data: { shop } });
};

exports.blockShop = async (req, res) => {
  const shop = await adminCatalogService.setShopStatus(req.params.id, SHOP_STATUS.BLOCKED);
  return success(res, { message: "Đã khóa gian hàng.", data: { shop } });
};

exports.unblockShop = async (req, res) => {
  const shop = await adminCatalogService.setShopStatus(req.params.id, SHOP_STATUS.ACTIVE);
  return success(res, { message: "Đã mở khóa gian hàng.", data: { shop } });
};

exports.deleteShop = async (req, res) => {
  const result = await adminCatalogService.deleteShop(req.params.id);
  return success(res, { message: "Đã xóa (đóng) gian hàng.", data: result });
};

exports.listProducts = async (req, res) => {
  const data = await adminCatalogService.listProducts({
    search: pickQueryValue(req.query, ["search", "q"]),
    status: pickQueryValue(req.query, ["status"]),
    removedBy: pickQueryValue(req.query, ["removedBy", "removed_by"]),
    shopId: pickQueryValue(req.query, ["shopId"]),
    categoryId: pickQueryValue(req.query, ["categoryId"]),
    page: req.query.page,
    limit: req.query.limit,
    ...pickDateRangeQuery(req.query),
  });
  return success(res, { data });
};

exports.getProductDetail = async (req, res) => {
  const product = await adminCatalogService.getProductDetail(req.params.id);
  return success(res, { data: { product } });
};

exports.hideProduct = async (req, res) => {
  const product = await adminCatalogService.setProductStatus(req.params.id, PRODUCT_STATUS.HIDDEN);
  return success(res, { message: "Đã ẩn sản phẩm.", data: { product } });
};

exports.showProduct = async (req, res) => {
  const product = await adminCatalogService.setProductStatus(req.params.id, PRODUCT_STATUS.ACTIVE);
  return success(res, { message: "Đã hiện sản phẩm.", data: { product } });
};

exports.deleteProduct = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "lyDoVP"]);
  const product = await adminCatalogService.deleteProduct(req.params.id, reason);
  return success(res, { message: "Đã gỡ sản phẩm và thông báo cho shop.", data: { product } });
};

exports.listReservations = async (req, res) => {
  const data = await adminCatalogService.listReservations({
    search: pickQueryValue(req.query, ["search", "q"]),
    status: pickQueryValue(req.query, ["status"]),
    shopId: pickQueryValue(req.query, ["shopId"]),
    page: req.query.page,
    limit: req.query.limit,
  });
  return success(res, { data });
};

exports.getReservationDetail = async (req, res) => {
  const reservation = await adminCatalogService.getReservationDetail(req.params.id);
  return success(res, { data: { reservation } });
};

exports.cancelReservation = async (req, res) => {
  const reason = pickBodyValue(req.body, ["reason", "cancelNote", "cancelReason"]);
  const reservation = await adminCatalogService.cancelReservation(req.params.id, reason);
  return success(res, { message: "Đã hủy đơn giữ hàng.", data: { reservation } });
};

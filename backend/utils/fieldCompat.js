const { MF } = require("../constants/modelFields");

function pickString(value) {
  return String(value || "").trim();
}

function readField(doc, newKey, legacyKeys = []) {
  if (!doc) {
    return undefined;
  }
  if (doc[newKey] !== undefined && doc[newKey] !== null) {
    return doc[newKey];
  }
  for (const key of legacyKeys) {
    if (doc[key] !== undefined && doc[key] !== null) {
      return doc[key];
    }
  }
  return undefined;
}

function readProductLyDoGo(product) {
  return pickString(readField(product, MF.LyDoGo, ["LyDoGo"]));
}

function readReviewLyDoGo(review) {
  return pickString(readField(review, MF.lyDoGo, ["lyDoGo", "moderationReason"]));
}

function readReservationTgNhanHang(reservation) {
  return readField(reservation, MF.tgNhanHang, ["tgNhanHang", "completedAt"]) || null;
}

function readReservationTgShopXN(reservation) {
  return readField(reservation, MF.tgShopXN, ["tgShopXN"]) || null;
}

function readReservationHanGiaiCoc(reservation) {
  return readField(reservation, MF.hanGiaiCoc, ["hanGiaiCoc"]) || null;
}

function readReservationCocChuyenDen(reservation) {
  const value = readField(reservation, MF.cocChuyenDen, ["cocChuyenDen"]);
  return value === undefined || value === null ? 0 : Number(value);
}

function readReservationSoNgayKN(reservation) {
  const value = readField(reservation, MF.soNgayKN, ["soNgayKN"]);
  return value === undefined || value === null ? null : Number(value);
}

function readReservationTgGiaiCoc(reservation) {
  return readField(reservation, MF.tgGiaiCoc, ["tgGiaiCoc"]) || null;
}

function readReservationAnhHuyShop(reservation) {
  return readField(reservation, MF.anhHuyShop, ["anhHuyShop"]) || [];
}

function readShopSoNguoiTheo(shop) {
  return Number(readField(shop, MF.soNguoiTheo, ["soNguoiTheo"])) || 0;
}

function readShopDiemTB(shop) {
  return Number(readField(shop, MF.diemTB, ["diemTB"])) || 0;
}

function readShopTongDG(shop) {
  return Number(readField(shop, MF.tongDG, ["tongDG"])) || 0;
}

function readShopTongSP(shop) {
  return Number(readField(shop, MF.tongSP, ["tongSP"])) || 0;
}

function readUserHoatDongCuoi(user) {
  return readField(user, MF.HoatDongCuoi, ["LanHoatDongCuoi"]) || null;
}

function readUserSoTheoDoi(user) {
  return Number(readField(user, MF.SoTheoDoi, ["SoTheoDoi"])) || 0;
}

function readProductPtGiam(product) {
  return Number(readField(product, MF.PtGiam, ["PtGiam"])) || 0;
}

function readProductNgayKmBD(product) {
  return readField(product, MF.NgayKmBD, ["NgayKmBD"]) || null;
}

function readProductNgayKmKT(product) {
  return readField(product, MF.NgayKmKT, ["NgayKmKT"]) || null;
}

function mongoOrLegacy(newKey, legacyKey) {
  return {
    $or: [{ [newKey]: { $exists: true } }, { [legacyKey]: { $exists: true } }],
  };
}

function mongoFieldRef(newKey, legacyKey) {
  return { $ifNull: [`$${newKey}`, `$${legacyKey}`] };
}

module.exports = {
  MF,
  readField,
  readProductLyDoGo,
  readReviewLyDoGo,
  readReservationTgNhanHang,
  readReservationTgShopXN,
  readReservationHanGiaiCoc,
  readReservationCocChuyenDen,
  readReservationSoNgayKN,
  readReservationTgGiaiCoc,
  readReservationAnhHuyShop,
  readShopSoNguoiTheo,
  readShopDiemTB,
  readShopTongDG,
  readShopTongSP,
  readUserSoTheoDoi,
  readUserHoatDongCuoi,
  readProductPtGiam,
  readProductNgayKmBD,
  readProductNgayKmKT,
  mongoOrLegacy,
  mongoFieldRef,
};

const MAX_EMBEDDED_IMAGES = 5;

const embeddedImagesField = {
  type: [String],
  default: [],
  validate: {
    validator: (value) => !Array.isArray(value) || value.length <= MAX_EMBEDDED_IMAGES,
    message: "Maximum 5 images",
  },
};

function pickString(value) {
  return String(value || "").trim();
}

/** Chuẩn hóa mảng URL ảnh (tối đa 5). */
function normalizeEmbeddedImages(value, max = MAX_EMBEDDED_IMAGES) {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) {
      return [value.trim()].slice(0, max);
    }
    return [];
  }
  return value.map(pickString).filter(Boolean).slice(0, max);
}

/** Đọc images từ doc — hỗ trợ legacy ProductImage/ReviewImage doc shape. */
function resolveImageUrls(source) {
  if (Array.isArray(source)) {
    if (source.length === 0) {
      return [];
    }
    if (typeof source[0] === "string") {
      return normalizeEmbeddedImages(source);
    }
    return source
      .map((item) => pickString(item?.ImageUrl || item?.imageUrl || item?.url))
      .filter(Boolean)
      .slice(0, MAX_EMBEDDED_IMAGES);
  }
  return normalizeEmbeddedImages(source);
}

/** API DTO — giữ shape cũ { id, imageUrl, stt } từ mảng URL. */
function toPublicImageList(urls = []) {
  return normalizeEmbeddedImages(urls).map((imageUrl, index) => ({
    id: String(index),
    imageUrl,
    stt: index,
    uploadedAt: null,
  }));
}

module.exports = {
  MAX_EMBEDDED_IMAGES,
  embeddedImagesField,
  normalizeEmbeddedImages,
  resolveImageUrls,
  toPublicImageList,
};

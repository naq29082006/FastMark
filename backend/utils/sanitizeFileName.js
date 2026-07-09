function removeVietnameseDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function sanitizeUploadLabel(value) {
  const ascii = removeVietnameseDiacritics(value)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return ascii || "item";
}

module.exports = {
  removeVietnameseDiacritics,
  sanitizeUploadLabel,
};

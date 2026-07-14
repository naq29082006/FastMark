export function resolveIsOutOfStock(product) {
  if (!product) {
    return false;
  }

  if (product.isUnavailable || Number(product.status) === 0) {
    return false;
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length > 0) {
    const total = variants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant.quantity ?? variant.Quantity) || 0),
      0
    );
    return total <= 0;
  }

  if (product.remainingQuantity != null && product.remainingQuantity !== '') {
    const remaining = Number(product.remainingQuantity);
    if (Number.isFinite(remaining) && remaining <= 0) {
      return Number(product.variantCount) > 0 || product.isOutOfStock === true;
    }
  }

  return product.isOutOfStock === true;
}

export function getProductImageOverlayLabel(product) {
  if (!product) {
    return null;
  }
  if (product.isUnavailable || Number(product.status) === 0) {
    return 'Không có sẵn';
  }
  if (resolveIsOutOfStock(product)) {
    return 'Hết hàng';
  }
  return null;
}

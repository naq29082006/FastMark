export function normalizeCategoryId(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'object') {
    const nestedId = value._id ?? value.id;
    if (nestedId !== undefined && nestedId !== null) {
      return String(nestedId).trim();
    }
  }

  const text = String(value).trim();
  if (!text || text === 'undefined' || text === 'null' || text === '[object Object]') {
    return '';
  }

  return text;
}

export function isValidCategoryId(value) {
  const id = normalizeCategoryId(value);
  return /^[a-f\d]{24}$/i.test(id);
}

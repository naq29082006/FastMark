const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeProductIsDeleted,
  isRemovedProduct,
  resolveProductRemovedBy,
} = require("../utils/productRemoval");

test("normalizeProductIsDeleted treats null/false/missing as active", () => {
  assert.equal(normalizeProductIsDeleted({}), 1);
  assert.equal(normalizeProductIsDeleted({ IsDeleted: null }), 1);
  assert.equal(normalizeProductIsDeleted({ IsDeleted: false }), 1);
  assert.equal(normalizeProductIsDeleted({ IsDeleted: 1 }), 1);
});

test("normalizeProductIsDeleted treats numeric 0 and true as removed", () => {
  assert.equal(normalizeProductIsDeleted({ IsDeleted: 0 }), 0);
  assert.equal(normalizeProductIsDeleted({ IsDeleted: true }), 0);
});

test("isRemovedProduct does not mark null IsDeleted as removed", () => {
  assert.equal(isRemovedProduct({ IsDeleted: null }), false);
  assert.equal(isRemovedProduct({ IsDeleted: 1, RemovedBy: "" }), false);
});

test("isRemovedProduct marks explicit removal", () => {
  assert.equal(isRemovedProduct({ IsDeleted: 0 }), true);
  assert.equal(isRemovedProduct({ IsDeleted: 1, RemovedBy: "admin" }), true);
  assert.equal(resolveProductRemovedBy({ IsDeleted: 0, LyDoGo: "spam" }), "admin");
});

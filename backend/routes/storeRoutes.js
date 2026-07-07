const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  listRestaurants,
  getRestaurant,
  listProductsByStore,
  getProduct,
  listReviewsByStore,
} = require('../controllers/storeController');

const router = express.Router();

router.get('/restaurants', asyncHandler(listRestaurants));
router.get('/restaurants/:id', asyncHandler(getRestaurant));
router.get('/restaurants/:id/products', asyncHandler(listProductsByStore));
router.get('/restaurants/:id/reviews', asyncHandler(listReviewsByStore));
router.get('/products/:productId', asyncHandler(getProduct));

module.exports = router;

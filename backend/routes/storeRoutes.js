const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  listRestaurants,
  getRestaurant,
  listProductsByStore,
  getProduct,
  listReviewsByStore,
} = require('../controllers/storeController');
const shopDiscoveryController = require('../controllers/shopDiscoveryController');

const router = express.Router();

router.get('/shops/nearby', asyncHandler(shopDiscoveryController.listNearbyShops));
router.get('/shops/:id', asyncHandler(shopDiscoveryController.getShop));
router.get('/shops/:id/products', asyncHandler(shopDiscoveryController.listShopProducts));
router.get('/shops/:id/reviews', asyncHandler(shopDiscoveryController.listShopReviews));
router.get('/restaurants', asyncHandler(listRestaurants));
router.get('/restaurants/:id', asyncHandler(getRestaurant));
router.get('/restaurants/:id/products', asyncHandler(listProductsByStore));
router.get('/restaurants/:id/reviews', asyncHandler(listReviewsByStore));
router.get('/products/:productId', asyncHandler(getProduct));

module.exports = router;

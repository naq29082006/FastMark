const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const shopDiscoveryController = require('../controllers/shopDiscoveryController');

const router = express.Router();

router.get('/shops/nearby', asyncHandler(shopDiscoveryController.listNearbyShops));
router.get('/shops/search', asyncHandler(shopDiscoveryController.searchShops));
router.get('/shops/categories', asyncHandler(shopDiscoveryController.listShopCategories));
router.get('/shops/:id', asyncHandler(shopDiscoveryController.getShop));
router.get('/shops/:id/products', asyncHandler(shopDiscoveryController.listShopProducts));
router.get('/shops/:id/reviews', asyncHandler(shopDiscoveryController.listShopReviews));

module.exports = router;

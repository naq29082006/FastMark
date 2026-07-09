const Restaurant = require('../models/Restaurant');
const DemoProduct = require('../models/DemoProduct');
const Review = require('../models/Review');

async function listRestaurants(req, res) {
  const type = req.query.type || 'all';
  const filter = type === 'all' ? {} : { type };

  const rows = await Restaurant.find(filter).sort({ name: 1 }).lean();
  const restaurants = rows.map((row) => ({
    id: row.externalId,
    name: row.name,
    type: row.type,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    phone: row.phone,
    zalo: row.zalo || row.phone,
    intro: row.intro,
    rating_avg: row.rating_avg,
    review_count: row.review_count,
    product_count: row.product_count,
  }));

  return res.json({ restaurants });
}

async function getRestaurant(req, res) {
  const row = await Restaurant.findOne({ externalId: req.params.id });

  if (!row) {
    return res.status(404).json({ error: 'Không tìm thấy gian hàng.' });
  }

  return res.json({ store: row.toClientStore() });
}

async function listProductsByStore(req, res) {
  const storeId = req.params.id;
  const rows = await DemoProduct.find({ store_id: storeId }).sort({ name: 1 });
  return res.json({ products: rows.map((row) => row.toClientProduct()) });
}

async function getProduct(req, res) {
  const row = await DemoProduct.findOne({ externalId: req.params.productId });

  if (!row) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
  }

  return res.json({ product: row.toClientProduct() });
}

async function listReviewsByStore(req, res) {
  const storeId = req.params.id;
  const rows = await Review.find({ store_id: storeId }).sort({ created_at: -1 });
  return res.json({ reviews: rows.map((row) => row.toClientReview()) });
}

module.exports = {
  listRestaurants,
  getRestaurant,
  listProductsByStore,
  getProduct,
  listReviewsByStore,
};

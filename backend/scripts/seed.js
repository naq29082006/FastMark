require('dotenv').config();

const mongoose = require('mongoose');
const Restaurant = require('./models/Restaurant');
const Product = require('./models/Product');
const Review = require('./models/Review');

const MOCK_STORES = [
  {
    externalId: '1',
    name: 'Cà phê Vy',
    type: 'cafe',
    latitude: 10.778,
    longitude: 106.702,
    address: '277 Phan Xích Long, Q. Phú Nhuận',
    phone: '0901234567',
    zalo: '0901234567',
    intro: 'Cà phê Vy là quán cà phê phong cách Sài Gòn xưa.',
    rating_avg: 4.7,
    review_count: 2,
    product_count: 2,
  },
  {
    externalId: '2',
    name: 'Bánh Mì Huỳnh Hoa',
    type: 'food',
    latitude: 10.7755,
    longitude: 106.699,
    address: '26 Lê Thị Riêng, Q.1',
    phone: '0902345678',
    zalo: '0902345678',
    intro: 'Bánh mì Huỳnh Hoa nổi tiếng với nhân đầy đặn.',
    rating_avg: 4.9,
    review_count: 2,
    product_count: 2,
  },
];

const MOCK_PRODUCTS = [
  {
    externalId: 'p-1-1',
    store_id: '1',
    name: 'Cà phê sữa đá',
    price: 35000,
    description: 'Cà phê rang xay pha sữa đặc.',
    image_emoji: '☕',
  },
  {
    externalId: 'p-1-2',
    store_id: '1',
    name: 'Bạc xỉu',
    price: 40000,
    description: 'Nhiều sữa, ít cà phê.',
    image_emoji: '🥛',
  },
  {
    externalId: 'p-2-1',
    store_id: '2',
    name: 'Bánh mì đặc biệt',
    price: 65000,
    description: 'Nhân đầy pate, chả, thịt nguội.',
    image_emoji: '🥖',
  },
  {
    externalId: 'p-2-2',
    store_id: '2',
    name: 'Bánh mì thường',
    price: 45000,
    description: 'Bánh mì truyền thống.',
    image_emoji: '🍞',
  },
];

const MOCK_REVIEWS = [
  {
    externalId: 'r-1-1',
    store_id: '1',
    user_name: 'Khách gần đây',
    rating: 5,
    comment: 'Cà phê thơm, không gian ấm cúng.',
    created_at: new Date('2026-07-01T09:00:00Z'),
  },
  {
    externalId: 'r-2-1',
    store_id: '2',
    user_name: 'Minh Anh',
    rating: 5,
    comment: 'Bánh mì ngon, nhân nhiều.',
    created_at: new Date('2026-06-28T14:30:00Z'),
  },
];

async function seed() {
  if (!process.env.MONGO_URI) {
    throw new Error('Thiếu MONGO_URI trong backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  await Promise.all([
    Restaurant.deleteMany({}),
    Product.deleteMany({}),
    Review.deleteMany({}),
  ]);

  await Restaurant.insertMany(MOCK_STORES);
  await Product.insertMany(MOCK_PRODUCTS);
  await Review.insertMany(MOCK_REVIEWS);

  console.log('Seeded:', {
    restaurants: MOCK_STORES.length,
    products: MOCK_PRODUCTS.length,
    reviews: MOCK_REVIEWS.length,
  });

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});

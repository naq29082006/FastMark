require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const DemoProduct = require('../models/DemoProduct');
const Category = require('../models/Category');
const Review = require('../models/Review');
const MOCK_STORES = [
  {
    externalId: '1',
    name: 'Cà phê Góc Xuân Phương',
    type: 'cafe',
    latitude: 21.0496,
    longitude: 105.7574,
    address: '52 Phúc Diễn, gần cầu Xuân Phương, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0901234567',
    zalo: '0901234567',
    intro: 'Quán cà phê nhỏ ngay đầu đường Phúc Diễn, cách cầu Xuân Phương vài bước chân.',
    rating_avg: 4.7,
    review_count: 2,
    product_count: 2,
    image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=200&fit=crop',
  },
  {
    externalId: '2',
    name: 'Bánh Mì 139 Phúc Diễn',
    type: 'food',
    latitude: 21.0489,
    longitude: 105.7569,
    address: '139 Phúc Diễn, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0902345678',
    zalo: '0902345678',
    intro: 'Bánh mì thịt nướng, pate và chả lụa đầy nhân khu Phúc Diễn.',
    rating_avg: 4.9,
    review_count: 2,
    product_count: 2,
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=200&fit=crop',
  },
  {
    externalId: '3',
    name: 'Phở Bò Phúc Diễn',
    type: 'food',
    latitude: 21.0501,
    longitude: 105.7582,
    address: '277 Phúc Diễn, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0903456789',
    zalo: '0903456789',
    intro: 'Phở bò Nam Định nước dùng trong ngọt.',
    rating_avg: 4.6,
    review_count: 1,
    product_count: 1,
    image_url: 'https://images.unsplash.com/photo-1582878826629-29ae7a4a44a5?w=400&h=200&fit=crop',
  },
  {
    externalId: '4',
    name: 'Trà Sữa Phúc Diễn',
    type: 'milktea',
    latitude: 21.0484,
    longitude: 105.7563,
    address: '88 Phúc Diễn, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0904567890',
    zalo: '0904567890',
    intro: 'Trà sữa trân châu gần cầu Xuân Phương.',
    rating_avg: 4.5,
    review_count: 1,
    product_count: 1,
    image_url: 'https://images.unsplash.com/photo-1525385133511-4f7b7e7c8b0e?w=400&h=200&fit=crop',
  },
  {
    externalId: '5',
    name: 'Ăn Vặt Cầu Xuân Phương',
    type: 'snack',
    latitude: 21.0493,
    longitude: 105.7577,
    address: 'Ngã ba Phúc Diễn - cầu Xuân Phương, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0905678901',
    zalo: '0905678901',
    intro: 'Ăn vặt ngay chân cầu Xuân Phương.',
    rating_avg: 4.4,
    review_count: 1,
    product_count: 1,
    image_url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=200&fit=crop',
  },
  {
    externalId: '6',
    name: 'Cà phê Góc Phúc Diễn',
    type: 'cafe',
    latitude: 21.0505,
    longitude: 105.7585,
    address: '45 Phúc Diễn, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0912345678',
    zalo: '0912345678',
    intro: 'Cà phê rang xay trên đường Phúc Diễn.',
    rating_avg: 4.6,
    review_count: 1,
    product_count: 1,
    image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=200&fit=crop',
  },
  {
    externalId: '7',
    name: 'Bún Đậu Phúc Diễn',
    type: 'food',
    latitude: 21.0486,
    longitude: 105.7566,
    address: '112 Phúc Diễn, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0923456789',
    zalo: '0923456789',
    intro: 'Bún đậu mắm tôm khu Phúc Diễn.',
    rating_avg: 4.8,
    review_count: 1,
    product_count: 1,
    image_url: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400&h=200&fit=crop',
  },
];

const MOCK_CATEGORIES = [
  { categoryName: 'Trái cây', description: 'Trái cây tươi các loại' },
  { categoryName: 'Rau củ', description: 'Rau củ quả sạch' },
  { categoryName: 'Thịt cá', description: 'Thịt, cá, hải sản' },
  { categoryName: 'Gia vị', description: 'Gia vị, nước chấm' },
  { categoryName: 'Đồ khô', description: 'Đồ khô, đặc sản' },
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
    throw new Error('Thiếu MONGO_URI trong .env ở thư mục gốc dự án');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  await Promise.all([
    Restaurant.deleteMany({}),
    DemoProduct.deleteMany({}),
    Review.deleteMany({}),
    Category.deleteMany({}),
  ]);

  await Restaurant.insertMany(MOCK_STORES);
  await Category.insertMany(MOCK_CATEGORIES);
  await DemoProduct.insertMany(MOCK_PRODUCTS);
  await Review.insertMany(MOCK_REVIEWS);

  console.log('Seeded:', {
    restaurants: MOCK_STORES.length,
    categories: MOCK_CATEGORIES.length,
    products: MOCK_PRODUCTS.length,
    reviews: MOCK_REVIEWS.length,
  });

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});

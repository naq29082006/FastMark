require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const ProductCategory = require('../models/ProductCategory');
const ShopCategory = require('../models/ShopCategory');

const PRODUCT_CATEGORIES = [
  'Thực phẩm',
  'Đồ uống',
  'Thời trang',
  'Điện tử',
  'Gia dụng',
  'Mỹ phẩm',
  'Khác',
];

const SHOP_CATEGORIES = [
  { name: 'Quán ăn', icon: '🍜' },
  { name: 'Cà phê', icon: '☕' },
  { name: 'Trà sữa', icon: '🧋' },
  { name: 'Ăn vặt', icon: '🍿' },
  { name: 'Tạp hóa', icon: '🏪' },
  { name: 'Thời trang', icon: '👗' },
  { name: 'Khác', icon: '🛒' },
];

async function seedProductCategories() {
  for (const name of PRODUCT_CATEGORIES) {
    await ProductCategory.findOneAndUpdate(
      { name },
      {
        $set: {
          name,
          categoryName: name,
          IsDeleted: 1,
          UpdatedAt: new Date(),
        },
        $setOnInsert: { CreatedAt: new Date() },
      },
      { upsert: true, new: true }
    );
  }
  console.log(`Seeded ${PRODUCT_CATEGORIES.length} product categories.`);
}

async function seedShopCategories() {
  for (const row of SHOP_CATEGORIES) {
    await ShopCategory.findOneAndUpdate(
      { name: row.name },
      {
        $set: {
          name: row.name,
          icon: row.icon,
          IsDeleted: 1,
          UpdatedAt: new Date(),
        },
        $setOnInsert: { CreatedAt: new Date() },
      },
      { upsert: true, new: true }
    );
  }
  console.log(`Seeded ${SHOP_CATEGORIES.length} shop categories.`);
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI in environment.');
  }

  await mongoose.connect(mongoUri);
  await seedProductCategories();
  await seedShopCategories();
  await mongoose.disconnect();
  console.log('Seed completed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

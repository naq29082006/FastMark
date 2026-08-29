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
  'Quán ăn',
  'Cà phê',
  'Trà sữa',
  'Ăn vặt',
  'Tạp hóa',
  'Thời trang',
  'Khác',
];

async function seedProductCategories() {
  for (const name of PRODUCT_CATEGORIES) {
    await ProductCategory.findOneAndUpdate(
      { name },
      {
        $set: {
          name,
          IsDeleted: 1,
          UpdatedAt: new Date(),
        },
        $setOnInsert: { CreatedAt: new Date() },
      },
      { upsert: true, returnDocument: "after" }
    );
  }
  console.log(`Seeded ${PRODUCT_CATEGORIES.length} product categories.`);
}

async function seedShopCategories() {
  for (const name of SHOP_CATEGORIES) {
    await ShopCategory.findOneAndUpdate(
      { name },
      {
        $set: {
          name,
          IsDeleted: 1,
          UpdatedAt: new Date(),
        },
        $unset: { icon: "" },
        $setOnInsert: { CreatedAt: new Date() },
      },
      { upsert: true, returnDocument: "after" }
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

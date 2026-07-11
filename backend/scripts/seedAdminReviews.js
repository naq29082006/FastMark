require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), override: false });

const { mongoUri } = require("../config/env");
const mongoose = require("mongoose");
const Review = require("../models/Review");
const BuyerReview = require("../models/BuyerReview");
const ShopProfile = require("../models/ShopProfile");
const User = require("../models/User");

const SEED_PREFIX = "seed-admin-review";

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function pickShopName(shop) {
  if (!shop) {
    return "";
  }
  return String(shop.shopName || shop.description || "").trim();
}

function buildSeedEntries(shops) {
  const shopA = shops[0];
  const shopB = shops[1] || shopA;
  const shopC = shops[2] || shopA;
  const shopD = shops[3] || shopA;

  return [
    {
      externalId: `${SEED_PREFIX}-001`,
      store_id: shopA ? String(shopA._id) : "1",
      user_name: "Nguyễn Văn Đoan",
      productName: "Trà sữa trân châu đường đen",
      rating: 5,
      comment: "Đồ uống ngon, giao nhanh, nhân viên phục vụ nhiệt tình.",
      is_hidden: false,
      created_at: daysAgo(0),
    },
    {
      externalId: `${SEED_PREFIX}-002`,
      store_id: shopB ? String(shopB._id) : "2",
      user_name: "Trần Thị Mai",
      productName: "Cà phê sữa đá",
      rating: 4,
      comment: "Vị cà phê ổn, không gian quán nhỏ nhưng sạch sẽ.",
      is_hidden: false,
      created_at: daysAgo(1),
    },
    {
      externalId: `${SEED_PREFIX}-003`,
      store_id: shopC ? String(shopC._id) : "3",
      user_name: "Lê Hoàng Nam",
      productName: "Bánh mì thịt nướng",
      rating: 2,
      comment: "Bánh hơi cứng, thịt ít hơn mô tả trên app.",
      is_hidden: true,
      created_at: daysAgo(2),
    },
    {
      externalId: `${SEED_PREFIX}-004`,
      store_id: shopD ? String(shopD._id) : "4",
      user_name: "Phạm Thu Hà",
      productName: "Phở bò tái",
      rating: 1,
      comment: "Nước dùng quá mặn, thịt bò không tươi như quảng cáo.",
      is_hidden: false,
      created_at: daysAgo(3),
    },
    {
      externalId: `${SEED_PREFIX}-005`,
      store_id: shopA ? String(shopA._id) : "1",
      user_name: "Hoàng Minh Tuấn",
      productName: "Combo trà sữa + bánh",
      rating: 3,
      comment: "Đồ ăn tạm được, giá hơi cao so với lượng.",
      is_hidden: false,
      created_at: daysAgo(4),
    },
    {
      externalId: `${SEED_PREFIX}-006`,
      store_id: shopD ? String(shopD._id) : "4",
      user_name: "Vũ Thị Lan",
      productName: "Trà đào cam sả",
      rating: 5,
      comment: "Rất thích vị trà đào, sẽ quay lại ủng hộ shop.",
      is_hidden: true,
      created_at: daysAgo(5),
    },
  ];
}

async function upsertSeedReview(entry, user, shopNameById) {
  const storeId = entry.store_id;
  const storeName = shopNameById.get(storeId) || "";
  const now = entry.created_at || new Date();

  let buyerReview = null;
  if (user) {
    buyerReview = await BuyerReview.findOneAndUpdate(
      {
        userId: user._id,
        storeId,
        orderCode: entry.externalId,
      },
      {
        $set: {
          storeName,
          productName: entry.productName,
          rating: entry.rating,
          comment: entry.comment,
          UpdatedAt: now,
        },
        $setOnInsert: {
          userId: user._id,
          storeId,
          orderCode: entry.externalId,
          imageUrl: "",
          CreatedAt: now,
        },
      },
      { upsert: true, new: true }
    );
  }

  const externalId = buyerReview ? `buyer-${buyerReview._id}` : entry.externalId;

  await Review.findOneAndUpdate(
    { externalId },
    {
      $set: {
        store_id: storeId,
        user_name: entry.user_name,
        rating: entry.rating,
        comment: entry.comment,
        is_hidden: Boolean(entry.is_hidden),
        is_deleted: false,
        deleted_at: null,
        created_at: now,
      },
    },
    { upsert: true }
  );

  if (entry.externalId !== externalId) {
    await Review.deleteOne({ externalId: entry.externalId }).catch(() => {});
  }

  return externalId;
}

async function seedAdminReviews() {
  if (!mongoUri) {
    throw new Error("Thiếu MONGO_URI trong .env");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  const shops = await ShopProfile.find().sort({ CreatedAt: 1 }).limit(6).lean();
  const userByEmail = await User.findOne({ Email: /doanday6868@gmail.com/i });
  const resolvedUser = userByEmail || (await User.findOne({ Role: 1 }).sort({ CreatedAt: 1 }));
  const shopNameById = new Map(
    shops.map((shop) => [String(shop._id), pickShopName(shop)])
  );
  const entries = buildSeedEntries(shops);

  const externalIds = [];
  for (const entry of entries) {
    const externalId = await upsertSeedReview(entry, resolvedUser, shopNameById);
    externalIds.push(externalId);
  }

  const total = await Review.countDocuments({ is_deleted: { $ne: true } });
  console.log("Seed đánh giá admin thành công:", {
    upserted: externalIds.length,
    shopsUsed: shops.length,
    linkedUser: resolvedUser ? resolvedUser.Email || resolvedUser.UserName : null,
    activeReviewsInDb: total,
  });

  await mongoose.disconnect();
}

seedAdminReviews().catch(async (error) => {
  console.error("Seed admin reviews failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), override: false });

const { mongoUri } = require("../config/env");

const mongoose = require("mongoose");
const User = require("../models/User");
const Report = require("../models/Report");
const ReportImage = require("../models/ReportImage");
const Review = require("../models/Review");
const Product = require("../models/Product");
const ShopProfile = require("../models/ShopProfile");
const { USER_ROLE } = require("../constants/sellerVerification");
const { REPORT_STATUS } = require("../constants/reportStatus");
const { REPORT_TYPE } = require("../constants/reportType");

const SEED_TAG = "seed-report-demo";

const SAMPLE_REVIEWS = [
  {
    externalId: "seed-review-001",
    store_id: "",
    user_name: "Nguyễn Văn A",
    rating: 1,
    comment: "Shop bán hàng kém chất lượng, giao sai món và phản hồi chậm.",
    created_at: new Date("2026-07-08T10:15:00+07:00"),
  },
  {
    externalId: "seed-review-002",
    store_id: "",
    user_name: "Trần Thị B",
    rating: 2,
    comment: "Đánh giá spam quảng cáo liên tục, nội dung không liên quan sản phẩm.",
    created_at: new Date("2026-07-09T14:40:00+07:00"),
  },
  {
    externalId: "seed-review-003",
    store_id: "",
    user_name: "Lê Hoàng C",
    rating: 1,
    comment: "Ngôn từ xúc phạm, thô tục khi trao đổi trong đánh giá.",
    created_at: new Date("2026-07-10T08:20:00+07:00"),
  },
];

const EVIDENCE_IMAGES = [
  "https://picsum.photos/seed/fastmark-evidence-1/640/480",
  "https://picsum.photos/seed/fastmark-evidence-2/640/480",
];

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function ensureSampleReviews(shops) {
  const shopIds = shops.map((shop) => String(shop._id));
  const reviewsWithStores = SAMPLE_REVIEWS.map((review, index) => ({
    ...review,
    store_id: shopIds[index % shopIds.length] || shopIds[0] || "",
  }));

  await Promise.all(
    reviewsWithStores.map((review) =>
      Review.findOneAndUpdate(
        { externalId: review.externalId },
        { $set: review },
        { upsert: true, new: true }
      )
    )
  );

  return Review.find({
    externalId: { $in: reviewsWithStores.map((item) => item.externalId) },
  }).lean();
}

function buildReportPayloads({ buyers, sellers, reviews, adminUser, products, shops }) {
  const buyerA = buyers[0];
  const buyerB = buyers[1] || buyers[0];
  const buyerC = buyers[2] || buyers[0];
  const sellerA = sellers[0];
  const sellerB = sellers[1] || sellers[0];
  const reviewA = reviews[0];
  const reviewB = reviews[1];
  const reviewC = reviews[2];
  const productA = products[0];

  if (!buyerA || !sellerA || !reviewA) {
    throw new Error("Cần ít nhất 1 người mua, 1 người bán và 1 đánh giá mẫu.");
  }

  return [
    {
      userId: buyerA._id,
      targetUserId: sellerA._id,
      reportType: REPORT_TYPE.REVIEW,
      reviewId: reviewA.externalId,
      title: "Spam / quảng cáo",
      content: `${SEED_TAG} Báo cáo đánh giá chứa nội dung spam quảng cáo dịch vụ khác.`,
      status: REPORT_STATUS.PENDING,
      CreatedAt: daysAgo(1),
      UpdatedAt: daysAgo(1),
      evidenceImages: [EVIDENCE_IMAGES[0]],
    },
    {
      userId: buyerB._id,
      targetUserId: sellerB._id,
      reportType: REPORT_TYPE.REVIEW,
      reviewId: reviewB.externalId,
      title: "Nội dung sai sự thật",
      content: `${SEED_TAG} Đánh giá bịa đặt thông tin, không khớp với đơn hàng thực tế.`,
      status: REPORT_STATUS.PENDING,
      CreatedAt: daysAgo(2),
      UpdatedAt: daysAgo(2),
      evidenceImages: [EVIDENCE_IMAGES[1]],
    },
    {
      userId: buyerC._id,
      targetUserId: sellerA._id,
      reportType: REPORT_TYPE.REVIEW,
      reviewId: reviewC.externalId,
      title: "Ngôn từ xúc phạm",
      content: `${SEED_TAG} Đánh giá dùng từ ngữ thô tục, xúc phạm người bán.`,
      status: REPORT_STATUS.PENDING,
      CreatedAt: daysAgo(0),
      UpdatedAt: daysAgo(0),
      evidenceImages: [],
    },
    {
      userId: buyerA._id,
      targetUserId: sellerB._id,
      productId: productA?._id || null,
      reportType: REPORT_TYPE.USER,
      title: "Sản phẩm giả mạo",
      content: `${SEED_TAG} Gian hàng đăng sản phẩm không đúng mô tả, nghi ngờ hàng giả.`,
      status: REPORT_STATUS.PENDING,
      CreatedAt: daysAgo(4),
      UpdatedAt: daysAgo(4),
      evidenceImages: [EVIDENCE_IMAGES[0]],
    },
    {
      userId: buyerA._id,
      targetUserId: sellerB._id,
      reportType: REPORT_TYPE.USER,
      title: "Hành vi lừa đảo",
      content: `${SEED_TAG} Người dùng liên hệ tráo đổi ngoài app và yêu cầu chuyển khoản trước.`,
      status: REPORT_STATUS.PROCESSED,
      processedBy: adminUser?._id || null,
      processedAt: daysAgo(1),
      CreatedAt: daysAgo(5),
      UpdatedAt: daysAgo(1),
      evidenceImages: [EVIDENCE_IMAGES[0], EVIDENCE_IMAGES[1]],
    },
    {
      userId: buyerB._id,
      targetUserId: sellerA._id,
      reportType: REPORT_TYPE.USER,
      title: "Tài khoản giả mạo",
      content: `${SEED_TAG} Nghi ngờ tài khoản mạo danh cửa hàng đã xác minh.`,
      status: REPORT_STATUS.REJECTED,
      processedBy: adminUser?._id || null,
      processedAt: daysAgo(2),
      CreatedAt: daysAgo(6),
      UpdatedAt: daysAgo(2),
      evidenceImages: [],
    },
    {
      userId: buyerC._id,
      targetUserId: sellerB._id,
      reportType: REPORT_TYPE.USER,
      title: "Quấy rối người mua",
      content: `${SEED_TAG} Người bán gửi tin nhắn quấy rối sau khi giao dịch không thành công.`,
      status: REPORT_STATUS.PENDING,
      CreatedAt: daysAgo(3),
      UpdatedAt: daysAgo(3),
      evidenceImages: [EVIDENCE_IMAGES[1]],
    },
  ];
}

async function seedReports() {
  if (!mongoUri) {
    throw new Error("Thiếu MONGO_URI trong .env");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  const existingCount = await Report.countDocuments({
    content: { $regex: SEED_TAG },
  });

  if (existingCount > 0) {
    console.log(`Đã có ${existingCount} báo cáo demo. Bỏ qua seed để tránh trùng lặp.`);
    await mongoose.disconnect();
    return;
  }

  const [buyers, sellers, adminUser, shops, products] = await Promise.all([
    User.find({ Role: USER_ROLE.BUYER }).sort({ CreatedAt: 1 }).limit(5).lean(),
    User.find({ Role: USER_ROLE.SELLER }).sort({ CreatedAt: 1 }).limit(5).lean(),
    User.findOne({ Role: USER_ROLE.ADMIN }).lean(),
    ShopProfile.find().sort({ CreatedAt: 1 }).limit(5).lean(),
    Product.find().sort({ CreatedAt: 1 }).limit(5).lean(),
  ]);

  if (!shops.length) {
    throw new Error("Không tìm thấy gian hàng trong DB. Hãy chạy seed cửa hàng trước.");
  }

  const reviews = await ensureSampleReviews(shops);

  if (!buyers.length || !sellers.length) {
    throw new Error(
      "Không tìm thấy đủ người mua/người bán trong DB. Hãy tạo tài khoản test trước khi chạy seed."
    );
  }

  const payloads = buildReportPayloads({ buyers, sellers, reviews, adminUser, products, shops });
  let createdReports = 0;
  let createdImages = 0;

  for (const payload of payloads) {
    const { evidenceImages = [], ...reportData } = payload;
    const report = await Report.create(reportData);
    createdReports += 1;

    if (evidenceImages.length) {
      await ReportImage.insertMany(
        evidenceImages.map((imageUrl) => ({
          reportId: report._id,
          imageUrl,
          CreatedAt: report.CreatedAt,
          UpdatedAt: report.UpdatedAt,
        }))
      );
      createdImages += evidenceImages.length;
    }
  }

  console.log("Seed báo cáo demo thành công:", {
    reports: createdReports,
    evidenceImages: createdImages,
    sampleReviews: reviews.length,
    buyersUsed: buyers.length,
    sellersUsed: sellers.length,
  });

  await mongoose.disconnect();
}

seedReports().catch(async (error) => {
  console.error("Seed reports failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

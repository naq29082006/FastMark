const fs = require("fs");
const path = require("path");

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "_models_extract.json"), "utf8")
);

/** Quan hệ nghiệp vụ bổ sung (ngoài ref field). */
const MODEL_RELATIONS = {
  User: [
    "1-1 → Wallet (userId)",
    "1-0..1 → ShopProfile (userId)",
    "1-N → Notification, Follow, FavoriteProduct, Reservation, Report, Review, WalletTransaction, WithdrawRequest",
  ],
  Wallet: ["1-1 → User (userId)"],
  SystemWallet: ["1 (singleton key=system) — escrow cọc giữ hàng"],
  ShopProfile: [
    "N-1 → User (userId)",
    "N-1 → ShopCategory (categoryId)",
    "1-N → Product, Reservation, SellerSubscription, SellerBannerPlan, Review",
  ],
  ShopCategory: ["1-N → ShopProfile"],
  ProductCategory: ["1-N → Product"],
  Product: [
    "N-1 → ShopProfile (ShopId)",
    "N-1 → ProductCategory (CategoryId)",
    "1-N → ProductVariant, FavoriteProduct, Review",
    "images[] — gallery URL (tối đa 5, phần tử đầu = cover)",
  ],
  ProductVariant: ["N-1 → Product (ProductId)", "1-N → Reservation (variantId)"],
  FavoriteProduct: ["N-1 → User; N-1 → Product (bảng nối N-N User↔Product)"],
  Follow: ["N-1 → User (follower); N-1 → User (following) — N-N User↔User"],
  Reservation: [
    "N-1 → User (buyer)",
    "N-1 → ShopProfile, Product, ProductVariant",
    "1-0..1 → ReservationDispute (khiếu nại + auditLogs)",
    "1-0..N → WalletTransaction (cọc)",
  ],
  ReservationDispute: [
    "N-1 → Reservation (unique)",
    "N-1 → User (người khiếu nại)",
    "auditLogs[] — nhật ký admin xử lý",
  ],
  Report: [
    "N-1 → User (reporter)",
    "N-1 → User/Shop/Product/Reservation (tùy reportType)",
    "images[] — ảnh minh chứng (tối đa 5)",
  ],
  Review: [
    "N-1 → User, Product, ShopProfile, Reservation (optional)",
    "images[] — ảnh đính kèm (tối đa 5)",
  ],
  Conversation: [
    "N-1 → User (participantA)",
    "N-1 → User (participantB)",
    "N-1 → ShopProfile (contextShopId, optional)",
    "1-N → Message",
  ],
  Message: ["N-1 → Conversation; N-1 → User (sender)"],
  Notification: ["N-1 → User"],
  WalletTransaction: ["N-1 → User; N-1 → Reservation (optional)"],
  WithdrawRequest: ["N-1 → User; N-1 → Bank (optional)"],
  Bank: ["1-N → WithdrawRequest (tham chiếu mã ngân hàng)"],
  Banner: ["N-1 → ShopProfile (shopId, optional)"],
  BannerPlan: ["1-N → SellerBannerPlan"],
  SellerBannerPlan: ["N-1 → User, ShopProfile, BannerPlan"],
  SellerPlan: ["1-N → SellerSubscription"],
  SellerSubscription: ["N-1 → User, ShopProfile, SellerPlan"],
  SellerVerification: ["N-1 → User (seller); N-1 → User (processedBy)"],
};

function esc(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

let md = [];
md.push("# FastMark — Tài liệu Models (MongoDB / Mongoose)");
md.push("");
md.push("> Nguồn: `backend/models/*.js` · Sinh tự động từ schema.");
md.push(">");
md.push("> **Ghi chú kiểu dữ liệu:** MongoDB không có `length` cố định như SQL.");
md.push("> - `ObjectId`: length = 24 (hex)");
md.push("> - `String`/`Number`/`Date`/`Boolean`: length = `-` trừ khi có min/max/maxlength");
md.push(">");
md.push("> **Key:** PK = khóa chính `_id` · UNIQUE · INDEX");
md.push(">");
md.push("> **Quan hệ trên field:** `N-1 → Model` = nhiều bản ghi trỏ 1 bản ghi (ref).");
md.push("> Quan hệ tổng hợp của model nằm ở đầu mỗi mục.");
md.push("");
md.push("## Mục lục models");
md.push("");
md.push("| STT | Model | Collection | Số trường | File |");
md.push("| ---: | --- | --- | ---: | --- |");
data.forEach((m, i) => {
  md.push(
    `| ${i + 1} | [${m.model}](#model-${m.model.toLowerCase()}) | \`${m.collection}\` | ${m.fields.length} | \`${m.file}\` |`
  );
});
md.push("");

data.forEach((m, i) => {
  md.push(`## Model: ${m.model}`);
  md.push("");
  md.push(`- **STT model:** ${i + 1}`);
  md.push(`- **Collection:** \`${m.collection}\``);
  md.push(`- **File:** \`${m.file}\``);
  if (m.indexes?.length) {
    md.push(`- **Index compound:** ${m.indexes.map((x) => `\`${x}\``).join(", ")}`);
  }
  const rels = MODEL_RELATIONS[m.model] || [];
  if (rels.length) {
    md.push(`- **Quan hệ tổng hợp:**`);
    rels.forEach((r) => md.push(`  - ${r}`));
  }
  md.push("");
  md.push("| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |");
  md.push("| ---: | --- | --- | --- | --- | --- | --- | --- |");
  m.fields.forEach((f) => {
    md.push(
      `| ${f.stt} | \`${esc(f.name)}\` | ${esc(f.type)} | ${esc(f.length)} | ${esc(f.notnull)} | ${esc(f.key)} | ${esc(f.note)} | ${esc(f.relation)} |`
    );
  });
  md.push("");
});

md.push("## Sơ đồ quan hệ chính (tóm tắt)");
md.push("");
md.push("```");
md.push("User 1──1 Wallet");
md.push("User 1──0..1 ShopProfile N──1 ShopCategory");
md.push("ShopProfile 1──N Product N──1 ProductCategory");
md.push("Product 1──N ProductVariant (images[] embedded on Product)");
md.push("User N──N Product (FavoriteProduct)");
md.push("User N──N User (Follow)");
md.push("User + Shop + Product + Variant → Reservation");
md.push("Reservation 1──0..1 ReservationDispute (title, content, images[], auditLogs[])");
md.push("Reservation ↔ WalletTransaction (cọc SystemWallet)");
md.push("User ↔ User Conversation 1──N Message");
md.push("SellerPlan 1──N SellerSubscription → ShopProfile");
md.push("BannerPlan 1──N SellerBannerPlan → ShopProfile");
md.push("```");
md.push("");

const outPath = path.join(__dirname, "..", "..", "docs", "DATABASE_MODELS.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md.join("\n"), "utf8");
// Mirror vào backend/docs cho gần source models.
fs.writeFileSync(path.join(__dirname, "..", "docs", "DATABASE_MODELS.md"), md.join("\n"), "utf8");
console.log("Wrote", outPath, "lines", md.length);

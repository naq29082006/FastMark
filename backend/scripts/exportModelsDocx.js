/**
 * Xuất tài liệu DATABASE MODELS ra .docx
 * - Cột STT: "1 PK" / "2 UK" / "5 FK" …
 * - Cột ghi chú: mô tả rõ trường là gì, làm gì, enum/status chi tiết
 *
 * Usage: cd backend && node scripts/exportModelsDocx.js
 */
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ShadingType,
  VerticalAlign,
} = require("docx");

const MODELS_DIR = path.join(__dirname, "..", "models");
const OUT_PATH = path.join(__dirname, "..", "..", "docs", "FASTMARK_DATABASE_MODELS.docx");

const HEADER_GREEN = "0F766E";
const HEADER_TEXT = "FFFFFF";
const ALT_ROW = "F0FDFA";

const ENUM_HELP = {
  Role: "Vai trò tài khoản. Enum: 1 = buyer, 2 = seller (đã duyệt), 3 = admin. Default 1.",
  Status_User: "Trạng thái tài khoản. Enum: 0 = bị khóa, 1 = hoạt động. Default 1.",
  AuthProvider: 'Phương thức đăng ký. Enum string: "email" | "google".',
  Status_Product: "Trạng thái sản phẩm. Enum: 0 = ẩn, 1 = đang bán.",
  Status_Shop: "Trạng thái gian hàng. Enum: 0 = bị khóa (admin), 1 = hoạt động.",
  isOpen: "Trạng thái mở cửa hiển thị. Enum: 0 = đóng cửa, 1 = đang mở.",
  Status_Reservation:
    "Trạng thái đơn giữ hàng. Enum: 0 = chờ shop xác nhận, 1 = từ chối (đã hoàn cọc), 2 = chờ nhận hàng, 3 = hoàn thành (QR), 4 = tranh chấp, 5 = tự hoàn thành (auto release cọc), 6 = đã hoàn cọc.",
  type_WalletTx:
    "Loại giao dịch ví. Enum: 1 = nạp tiền, 2 = thanh toán, 3 = hoàn tiền, 4 = rút tiền, 5 = đặt cọc giữ hàng (buyer→system), 6 = hoàn cọc (system→buyer), 7 = giải phóng cọc (system→seller).",
  status_WalletTx:
    "Trạng thái giao dịch. Enum: 0 = đang chờ, 1 = thành công, 2 = thất bại, 3 = đã hủy. Default 0.",
  status_Withdraw:
    "Trạng thái yêu cầu rút. Enum: 0 = chờ duyệt, 1 = đã duyệt, 2 = từ chối.",
  reportType:
    "Loại báo cáo. Enum: 1 = đánh giá, 2 = người dùng, 3 = gian hàng, 4 = sản phẩm, 5 = buyer no-show, 6 = seller no-show, 7 = sự cố SP (giữ hàng), 8 = khác (giữ hàng).",
  status_Report:
    "Trạng thái xử lý báo cáo. Enum: 0 = chờ xử lý, 1 = đã duyệt/xử lý, 2 = bác bỏ.",
  messageType: "Loại tin nhắn. Enum: 0 = text, 1 = ảnh, 2 = offer/đề nghị giá.",
  messageStatus: "Trạng thái gửi tin. Enum: 0 = đã gửi, 1 = đã tới, 2 = đã xem.",
  IsRead: "Đã đọc bởi đối phương. Enum: 0 = chưa đọc, 1 = đã đọc.",
  senderType: "Ai gửi theo ngữ cảnh chat. Enum: 0 = phía buyer/user, 1 = phía shop/seller.",
  targetType_Banner:
    "Loại đích khi bấm banner. Enum: 1 = sản phẩm, 2 = gian hàng, 3 = danh mục, 4 = khuyến mãi/chung.",
  status_SellerBanner:
    "Trạng thái SellerBannerPlan. Enum: 1 = đang hoạt động, 2 = đã hủy, 3 = admin từ chối (vi phạm). Hết hạn dựa endDate, không dùng status riêng.",
  status_SellerSub:
    "Trạng thái gói bán hàng. Enum: 0 = chờ thanh toán, 1 = đang hiệu lực, 2 = hết hạn, 3 = đã hủy.",
  status_SellerVerify:
    "Trạng thái đơn đăng ký seller. Enum: 0 = chờ duyệt, 1 = đã duyệt, 2 = từ chối.",
  DiscountPercent:
    "Phần trăm giảm giá khuyến mãi (1–100). Đây là nguồn chính khi bật KM; PromotionPrice được suy ra từ OriginalPrice × (1 − %/100).",
};

const MODEL_META = {
  User: {
    collection: "users",
    desc: "Tài khoản người dùng (auth Firebase, hồ sơ, role, presence).",
    relations:
      "User (1): Wallet 1-1; ShopProfile 0|1-1; 1-N → SellerVerification, Notification, Follow, Reservation, Review, Report, Conversation, Message, WalletTransaction, WithdrawRequest.",
  },
  Wallet: {
    collection: "wallets",
    desc: "Ví tiền người dùng — lưu số dư hiện tại.",
    relations: "1-1 → User (userId); 1-N → WalletTransaction.",
  },
  SystemWallet: {
    collection: "systemwallets",
    desc: "Ví hệ thống (escrow) giữ tiền cọc đơn giữ hàng.",
    relations: "Singleton key=system; liên kết logic với Reservation deposit.",
  },
  WalletTransaction: {
    collection: "wallettransactions",
    desc: "Lịch sử giao dịch ví (nạp / cọc / hoàn / rút / giải ngân).",
    relations: "N-1 → User; N-1 → Reservation (optional, cọc escrow).",
  },
  WithdrawRequest: {
    collection: "withdrawrequests",
    desc: "Yêu cầu rút tiền từ ví về tài khoản ngân hàng.",
    relations: "N-1 → User; N-1 → Bank (optional).",
  },
  Bank: {
    collection: "banks",
    desc: "Danh mục ngân hàng được phép rút tiền.",
    relations: "1-N → WithdrawRequest (tham chiếu mã NH).",
  },
  ShopProfile: {
    collection: "shopprofiles",
    desc: "Hồ sơ gian hàng của seller.",
    relations:
      "N-1 → User, ShopCategory; 1-N → Product, Reservation, SellerSubscription, SellerBannerPlan, Review.",
  },
  ShopCategory: {
    collection: "shopcategories",
    desc: "Danh mục ngành nghề gian hàng.",
    relations: "1-N → ShopProfile, SellerVerification.",
  },
  SellerVerification: {
    collection: "sellerverifications",
    desc: "Hồ sơ đăng ký bán hàng chờ admin duyệt.",
    relations: "N-1 → User (seller); N-1 → ShopCategory; N-1 → User (processedBy).",
  },
  SellerPlan: {
    collection: "sellerplans",
    desc: "Gói bán hàng (số ngày + giá) do admin cấu hình.",
    relations: "1-N → SellerSubscription.",
  },
  SellerSubscription: {
    collection: "sellersubscriptions",
    desc: "Lịch sử mua / gia hạn gói bán hàng của shop.",
    relations: "N-1 → User, ShopProfile, SellerPlan.",
  },
  BannerPlan: {
    collection: "bannerplans",
    desc: "Gói banner quảng cáo (số ngày + giá).",
    relations: "1-N → SellerBannerPlan.",
  },
  SellerBannerPlan: {
    collection: "sellerbannerplans",
    desc: "Lần mua banner + creative Home (random active). Có clickCount + violationReason.",
    relations: "N-1 → User, ShopProfile, BannerPlan.",
  },
  ProductCategory: {
    collection: "categories",
    desc: "Danh mục sản phẩm.",
    relations: "1-N → Product.",
  },
  Product: {
    collection: "products",
    desc: "Sản phẩm của shop (có khuyến mãi theo % giảm giá). Gallery ảnh trong images[] (tối đa 5).",
    relations:
      "N-1 → ShopProfile, ProductCategory; 1-N → ProductVariant, FavoriteProduct, Review.",
  },
  ProductVariant: {
    collection: "productvariants",
    desc: "Biến thể sản phẩm (tên phân loại, giá, tồn kho).",
    relations: "N-1 → Product; 1-N → Reservation.",
  },
  FavoriteProduct: {
    collection: "favoriteproducts",
    desc: "Sản phẩm yêu thích — bảng nối N–N User ↔ Product.",
    relations: "N-1 → User; N-1 → Product.",
  },
  Follow: {
    collection: "follows",
    desc: "Quan hệ theo dõi người dùng — bảng nối N–N User ↔ User.",
    relations: "N-1 → User (followerId); N-1 → User (followedUserId).",
  },
  Reservation: {
    collection: "reservations",
    desc: "Đơn giữ hàng / nhận sau; cọc escrow qua SystemWallet.",
    relations:
      "N-1 → User, ShopProfile, Product, ProductVariant; 1-0..1 ReservationDispute; 1-N → WalletTransaction.",
  },
  ReservationDispute: {
    collection: "reservationdisputes",
    desc: "Tranh chấp 1 đơn: buyerUserId + sellerShopId (ShopProfile), auditLogs[]. Không lưu GPS.",
    relations: "N-1 → Reservation (unique); buyer/seller complaint embed.",
  },
  Review: {
    collection: "reviews",
    desc: "Đánh giá sản phẩm / gian hàng sau đơn hoàn thành. Ảnh đính kèm trong images[] (tối đa 5).",
    relations: "N-1 → User, Product, ShopProfile, Reservation.",
  },
  Conversation: {
    collection: "conversations",
    desc: "Cuộc trò chuyện giữa hai user (buyer–seller).",
    relations:
      "N-1 → User (participantA/B); N-1 → ShopProfile (context, optional); 1-N → Message.",
  },
  Message: {
    collection: "messages",
    desc: "Tin nhắn trong conversation.",
    relations: "N-1 → Conversation; N-1 → User (sender).",
  },
  Notification: {
    collection: "notifications",
    desc: "Thông báo đẩy / inbox hệ thống cho user.",
    relations: "N-1 → User.",
  },
  Report: {
    collection: "reports",
    desc: "Báo cáo nội dung (review/shop/product) hoặc khiếu nại khóa tài khoản.",
    relations: "N-1 → User (reporter); optional → User/Shop/Product.",
  },
};

/** Parse comment // ngay trên mỗi field trong file model. */
function parseFieldComments(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const map = {};
  const lines = src.split(/\r?\n/);
  let pending = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const comment = line.match(/^\s*\/\/\s*(.+)\s*$/);
    if (comment) {
      const text = comment[1].trim();
      if (!text.startsWith("---") && !text.startsWith("Gallery")) {
        pending.push(text.replace(/\s*—\s*/g, ". ").replace(/\s+/g, " "));
      }
      continue;
    }
    const field = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    if (field && pending.length) {
      map[field[1]] = pending.join(" ");
      pending = [];
    } else if (!/^\s*$/.test(line) && !/^\s*\/\*/.test(line) && !/^\s*\*/.test(line)) {
      pending = [];
    }
  }
  return map;
}

function mongooseType(schemaType) {
  if (!schemaType) return "Mixed";
  const iname = schemaType.instance || "";
  if (schemaType.instance === "Array" || schemaType.$isMongooseArray) {
    const caster = schemaType.caster;
    if (caster) return "Array<" + mongooseType(caster) + ">";
    return "Array";
  }
  if (iname === "ObjectID" || iname === "ObjectId") return "ObjectId";
  return iname || "Mixed";
}

function lengthOf(schemaType, typeName) {
  if (typeName === "ObjectId") return "24 hex";
  const minL = schemaType?.options?.minlength ?? schemaType?.options?.minLength;
  const maxL = schemaType?.options?.maxlength ?? schemaType?.options?.maxLength;
  if (minL != null && maxL != null) return `${minL}-${maxL}`;
  if (maxL != null) return String(maxL);
  if (minL != null) return `≥${minL}`;
  if (
    typeName === "Number" &&
    schemaType?.options?.min != null &&
    schemaType?.options?.max != null
  ) {
    return `${schemaType.options.min}..${schemaType.options.max}`;
  }
  if (schemaType?.options?.enum) return "enum";
  return "-";
}

function keyFlags(pathName, schemaType, schema) {
  const flags = [];
  if (pathName === "_id") flags.push("PK");
  if (schemaType?.options?.unique) {
    flags.push(schemaType.options.sparse ? "UK" : "UK");
  }
  if (schemaType?.options?.ref || schemaType?.caster?.options?.ref) flags.push("FK");
  // compound unique often means UK-ish but keep FK/UK from options
  const indexes = schema.indexes?.() || [];
  for (const [fields, opts] of indexes) {
    if (fields && Object.prototype.hasOwnProperty.call(fields, pathName) && opts?.unique) {
      if (!flags.includes("UK") && pathName !== "_id") flags.push("UK");
    }
  }
  return flags;
}

function relationOf(schemaType) {
  const ref = schemaType?.options?.ref || schemaType?.caster?.options?.ref;
  if (!ref) return "-";
  return `N-1 → ${ref}`;
}

function enrichNote(modelName, pathName, schemaType, baseComment) {
  const parts = [];

  if (pathName === "_id") {
    parts.push("ID giao dịch / bản ghi do MongoDB tự sinh (khóa chính).");
  } else if (baseComment) {
    parts.push(baseComment);
  } else {
    parts.push(`Trường ${pathName}.`);
  }

  // Enum / status đặc thù
  if (modelName === "User" && pathName === "Role") parts.push(ENUM_HELP.Role);
  if (modelName === "User" && pathName === "Status") parts.push(ENUM_HELP.Status_User);
  if (modelName === "User" && pathName === "AuthProvider") parts.push(ENUM_HELP.AuthProvider);
  if (modelName === "Product" && pathName === "Status") parts.push(ENUM_HELP.Status_Product);
  if (modelName === "Product" && pathName === "DiscountPercent") parts.push(ENUM_HELP.DiscountPercent);
  if (modelName === "ShopProfile" && pathName === "status") parts.push(ENUM_HELP.Status_Shop);
  if (modelName === "ShopProfile" && pathName === "isOpen") parts.push(ENUM_HELP.isOpen);
  if (modelName === "Reservation" && pathName === "status") parts.push(ENUM_HELP.Status_Reservation);
  if (modelName === "WalletTransaction" && pathName === "type") parts.push(ENUM_HELP.type_WalletTx);
  if (modelName === "WalletTransaction" && pathName === "status") parts.push(ENUM_HELP.status_WalletTx);
  if (modelName === "WithdrawRequest" && pathName === "status") parts.push(ENUM_HELP.status_Withdraw);
  if (modelName === "Report" && pathName === "reportType") parts.push(ENUM_HELP.reportType);
  if (modelName === "Report" && pathName === "status") parts.push(ENUM_HELP.status_Report);
  if (modelName === "Message" && pathName === "messageType") parts.push(ENUM_HELP.messageType);
  if (modelName === "Message" && pathName === "status") parts.push(ENUM_HELP.messageStatus);
  if (modelName === "Message" && pathName === "IsRead") parts.push(ENUM_HELP.IsRead);
  if (modelName === "Message" && pathName === "senderType") parts.push(ENUM_HELP.senderType);
  if (modelName === "SellerBannerPlan" && pathName === "targetType") {
    parts.push(ENUM_HELP.targetType_Banner);
  }
  if (modelName === "SellerBannerPlan" && pathName === "status") {
    parts.push(ENUM_HELP.status_SellerBanner);
  }
  if (modelName === "SellerSubscription" && pathName === "status") {
    parts.push(ENUM_HELP.status_SellerSub);
  }
  if (modelName === "SellerVerification" && pathName === "status") {
    parts.push(ENUM_HELP.status_SellerVerify);
  }

  // WalletTransaction friendly labels matching screenshot style
  if (modelName === "WalletTransaction") {
    const map = {
      _id: "ID giao dịch.",
      CreatedAt: "Thời gian tạo giao dịch.",
      UpdatedAt: "Thời gian cập nhật cuối.",
      userId: "Chủ sở hữu giao dịch (user có ví bị trừ/cộng).",
      reservationId: "Đơn giữ hàng liên quan (khi là cọc escrow).",
      amount: "Số tiền giao dịch (VND).",
      balanceBefore: "Số dư ví trước giao dịch.",
      balanceAfter: "Số dư ví sau giao dịch.",
      description: "Mô tả nội dung giao dịch hiển thị cho user.",
      orderCode: "Mã đối soát nội bộ / PayOS (unique).",
      paymentLinkId: "ID link thanh toán cổng PayOS (nếu nạp).",
      checkoutUrl: "URL checkout cổng thanh toán (nếu nạp).",
      referenceId: "ID đối tượng tham chiếu (Reservation/Report/…).",
      referenceType: "Loại tham chiếu: Reservation | Report | WithdrawRequest | Topup.",
    };
    if (map[pathName] && !baseComment) {
      parts.unshift(map[pathName]);
    } else if (map[pathName] && pathName === "userId") {
      // keep both
    }
  }

  if (schemaType?.options?.default !== undefined) {
    const d = schemaType.options.default;
    if (typeof d === "function") parts.push("Default: Date.now / hàm.");
    else parts.push(`Default: ${JSON.stringify(d)}.`);
  }
  if (schemaType?.options?.enum && !parts.some((p) => p.includes("Enum"))) {
    const vals = schemaType.options.enum;
    parts.push(`Giá trị enum schema: ${vals.join(", ")}.`);
  }
  if (schemaType?.options?.min != null || schemaType?.options?.max != null) {
    const a = [];
    if (schemaType.options.min != null) a.push(`min=${schemaType.options.min}`);
    if (schemaType.options.max != null) a.push(`max=${schemaType.options.max}`);
    parts.push(`Ràng buộc: ${a.join(", ")}.`);
  }

  // Deduplicate similar sentences
  const seen = new Set();
  const unique = [];
  for (const p of parts) {
    const key = p.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique.join(" ");
}

function cell(text, opts = {}) {
  const {
    bold = false,
    color = "000000",
    fill = null,
    width = 1200,
    align = AlignmentType.LEFT,
  } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
    },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: String(text ?? "-"),
            bold,
            color,
            size: opts.header ? 17 : 15,
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

function headerRow(widths) {
  const labels = ["STT", "name", "type", "Length", "not null", "key", "ghi chú", "quan hệ"];
  return new TableRow({
    tableHeader: true,
    children: labels.map((label, i) =>
      cell(label, {
        bold: true,
        color: HEADER_TEXT,
        fill: HEADER_GREEN,
        width: widths[i],
        header: true,
        align: AlignmentType.CENTER,
      })
    ),
  });
}

function extractModels() {
  const files = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith(".js")).sort();
  const models = [];

  for (const f of files) {
    const full = path.resolve(MODELS_DIR, f);
    const comments = parseFieldComments(full);
    const before = new Set(mongoose.modelNames());
    delete require.cache[full];
    let mod;
    try {
      mod = require(full);
    } catch (e) {
      console.error("ERR", f, e.message);
      continue;
    }
    const after = mongoose.modelNames().filter((n) => !before.has(n));
    let model = null;
    if (mod && mod.modelName && mod.schema) model = mod;
    else if (after.length) model = mongoose.model(after[after.length - 1]);
    if (!model?.schema) continue;

    const schema = model.schema;
    const fields = [];
    let stt = 1;

    const pushField = (pathName, st) => {
      const typeName = pathName === "_id" ? "ObjectId" : mongooseType(st);
      const flags = keyFlags(pathName, st, schema);
      const sttLabel = flags.length ? `${stt} ${flags.join("/")}` : String(stt);
      fields.push({
        stt: sttLabel,
        name: pathName,
        type: typeName,
        length: pathName === "_id" ? "24 hex" : lengthOf(st, typeName),
        notnull:
          pathName === "_id" || st?.isRequired || st?.options?.required ? "YES" : "NO",
        key: flags.length ? flags.join(", ") : "-",
        note: enrichNote(model.modelName, pathName, st, comments[pathName] || ""),
        relation: pathName === "_id" ? "-" : relationOf(st),
      });
      stt += 1;
    };

    pushField("_id", schema.paths._id);
    for (const pathName of Object.keys(schema.paths).sort()) {
      if (pathName === "_id" || pathName === "__v") continue;
      pushField(pathName, schema.paths[pathName]);
    }

    const meta = MODEL_META[model.modelName] || {
      collection: model.collection.collectionName,
      desc: model.modelName,
      relations: "-",
    };

    models.push({
      model: model.modelName,
      collection: meta.collection || model.collection.collectionName,
      desc: meta.desc,
      relations: meta.relations,
      fields,
      file: f,
    });
  }

  const order = [
    "User",
    "Wallet",
    "SystemWallet",
    "WalletTransaction",
    "WithdrawRequest",
    "Bank",
    "ShopCategory",
    "ShopProfile",
    "SellerVerification",
    "SellerPlan",
    "SellerSubscription",
    "ProductCategory",
    "Product",
    "ProductVariant",
    "FavoriteProduct",
    "Follow",
    "Reservation",
    "ReservationDispute",
    "Review",
    "Conversation",
    "Message",
    "Notification",
    "Report",
    "BannerPlan",
    "SellerBannerPlan",
  ];
  models.sort((a, b) => {
    const ia = order.indexOf(a.model);
    const ib = order.indexOf(b.model);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return models;
}

async function main() {
  const models = extractModels();
  // STT rộng hơn vì có PK/FK/UK
  const widths = [900, 1500, 1100, 800, 700, 900, 2600, 1600];
  const children = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: "FASTMARK — TÀI LIỆU DATABASE MODELS",
          bold: true,
          color: "0F766E",
          size: 36,
          font: "Calibri",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: "Backend MongoDB / Mongoose · Sinh từ backend/models/*.js",
          italics: true,
          size: 20,
          color: "64748B",
          font: "Calibri",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text:
            "Ghi chú: Cột STT ghi số thứ tự kèm PK/FK/UK ở đầu (vd: 1 PK, 5 FK). Length = minlength–maxlength (− nếu không giới hạn). not null = YES khi required: true. Cột ghi chú mô tả trường làm gì và giải thích enum/status.",
          size: 17,
          font: "Calibri",
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({ text: "A. Danh sách bảng / collection", bold: true, color: "0F766E", size: 28 }),
      ],
    })
  );

  const tocWidths = [600, 2800, 6200];
  children.push(
    new Table({
      width: { size: 9600, type: WidthType.DXA },
      columnWidths: tocWidths,
      rows: [
        new TableRow({
          children: [
            cell("NO", {
              bold: true,
              color: HEADER_TEXT,
              fill: HEADER_GREEN,
              width: tocWidths[0],
              align: AlignmentType.CENTER,
              header: true,
            }),
            cell("Bảng (Model)", {
              bold: true,
              color: HEADER_TEXT,
              fill: HEADER_GREEN,
              width: tocWidths[1],
              header: true,
            }),
            cell("Làm gì", {
              bold: true,
              color: HEADER_TEXT,
              fill: HEADER_GREEN,
              width: tocWidths[2],
              header: true,
            }),
          ],
        }),
        ...models.map(
          (m, i) =>
            new TableRow({
              children: [
                cell(String(i + 1), {
                  width: tocWidths[0],
                  align: AlignmentType.CENTER,
                  fill: i % 2 ? ALT_ROW : null,
                }),
                cell(`${m.collection} (${m.model})`, {
                  width: tocWidths[1],
                  fill: i % 2 ? ALT_ROW : null,
                }),
                cell(m.desc, { width: tocWidths[2], fill: i % 2 ? ALT_ROW : null }),
              ],
            })
        ),
      ],
    })
  );

  children.push(new Paragraph({ spacing: { before: 280 }, children: [] }));
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({ text: "B. Chi tiết cột từng bảng", bold: true, color: "0F766E", size: 28 }),
      ],
    })
  );

  models.forEach((m, idx) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 260, after: 60 },
        children: [
          new TextRun({
            text: `${idx + 1}. ${m.collection} (${m.model})`,
            bold: true,
            color: "1E3A5F",
            size: 24,
            font: "Calibri",
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: m.desc, size: 17, font: "Calibri", color: "334155" })],
      })
    );

    children.push(
      new Table({
        width: { size: 9600, type: WidthType.DXA },
        columnWidths: widths,
        rows: [
          headerRow(widths),
          ...m.fields.map(
            (f, i) =>
              new TableRow({
                children: [
                  cell(f.stt, {
                    width: widths[0],
                    align: AlignmentType.CENTER,
                    fill: i % 2 ? ALT_ROW : null,
                    bold: String(f.stt).includes("P") || String(f.stt).includes("F") || String(f.stt).includes("U"),
                  }),
                  cell(f.name, { width: widths[1], fill: i % 2 ? ALT_ROW : null }),
                  cell(f.type, { width: widths[2], fill: i % 2 ? ALT_ROW : null }),
                  cell(f.length, { width: widths[3], fill: i % 2 ? ALT_ROW : null }),
                  cell(f.notnull, {
                    width: widths[4],
                    align: AlignmentType.CENTER,
                    fill: i % 2 ? ALT_ROW : null,
                  }),
                  cell(f.key, { width: widths[5], fill: i % 2 ? ALT_ROW : null }),
                  cell(f.note, { width: widths[6], fill: i % 2 ? ALT_ROW : null }),
                  cell(f.relation, { width: widths[7], fill: i % 2 ? ALT_ROW : null }),
                ],
              })
          ),
        ],
      })
    );

    children.push(
      new Paragraph({
        spacing: { before: 90, after: 140 },
        children: [
          new TextRun({ text: "Quan hệ: ", bold: true, size: 17, font: "Calibri" }),
          new TextRun({ text: m.relations, size: 17, font: "Calibri", color: "334155" }),
        ],
      })
    );
  });

  const doc = new Document({
    creator: "FastMark",
    title: "FASTMARK — TÀI LIỆU DATABASE MODELS",
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 640, bottom: 720, left: 640 },
          },
        },
        children,
      },
    ],
  });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT_PATH, buffer);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Models: ${models.length}, size: ${buffer.length} bytes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

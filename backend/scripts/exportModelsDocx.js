/**
 * Xuất tài liệu DATABASE MODELS ra .docx
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
  VerticalAlign,
} = require("docx");

const MODELS_DIR = path.join(__dirname, "..", "models");
const OUT_PATH =
  process.env.OUT_PATH ||
  path.join(__dirname, "..", "..", "docs", "FASTMARK_DATABASE_MODELS.docx");

const FONT = "Times New Roman";
const FONT_SIZE = 28; // 14pt

/** Độ rộng cột (DXA) theo yêu cầu tài liệu. */
const WIDTHS = [1111, 3836, 2037, 1455, 1217, 1323, 5662];
const TABLE_WIDTH = WIDTHS.reduce((sum, w) => sum + w, 0);

const CELL_MARGIN = { top: 40, bottom: 40, left: 100, right: 100 };

const ENUM_HELP = {
  Role: "1=buyer, 2=seller, 3=admin",
  Status_User: "0=khóa, 1=hoạt động",
  AuthProvider: "email | google",
  Status_Product: "0=ẩn, 1=đang bán",
  Status_Shop: "0=khóa, 1=hoạt động",
  isOpen: "0=đóng cửa, 1=mở cửa",
  Status_Reservation: "0=chờ, 1=giữ hàng, 2=đã nhận, 3=tranh chấp, 4=hoàn thành, 5=hủy",
  type_WalletTx: "1=nạp, 2=TT, 3=hoàn, 4=rút, 5=cọc, 6=hoàn cọc, 7=giải ngân",
  status_WalletTx: "0=chờ, 1=OK, 2=lỗi, 3=hủy",
  status_Withdraw: "0=chờ, 1=duyệt, 2=từ chối",
  reportType: "1=review, 2=shop, 3=SP, 4=hệ thống, 5=khác, 6=khiếu nại nick, 7=khiếu nại shop",
  status_Report: "0=chờ, 1=đã xử lý, 2=bác bỏ",
  status_SellerBanner: "1=chạy, 2=hủy, 3=admin từ chối",
  status_SellerSub: "0=chờ TT, 1=hiệu lực, 2=hết hạn, 3=hủy",
  status_SellerVerify: "0=chờ, 1=duyệt, 2=từ chối",
  cocChuyenDen: "0=escrow, 1=hoàn buyer, 2=giải ngân seller",
};

const MODEL_META = {
  User: { title: "User", desc: "Tài khoản người dùng (Firebase auth, role, trạng thái)." },
  Wallet: { title: "Wallet", desc: "Ví tiền người dùng — số dư hiện tại." },
  SystemWallet: { title: "SystemWallet", desc: "Ví hệ thống escrow giữ cọc đơn hàng (1 bản ghi/collection)." },
  WalletTransaction: { title: "WalletTransaction", desc: "Lịch sử giao dịch ví." },
  WithdrawRequest: { title: "WithdrawRequest", desc: "Yêu cầu rút tiền về ngân hàng." },
  Bank: { title: "Bank", desc: "Danh mục ngân hàng hỗ trợ rút tiền." },
  ShopProfile: { title: "ShopProfile", desc: "Hồ sơ gian hàng seller." },
  ShopCategory: { title: "ShopCategory", desc: "Danh mục ngành nghề gian hàng." },
  SellerVerification: { title: "SellerVerification", desc: "Hồ sơ đăng ký bán hàng (KYC)." },
  SellerPlan: { title: "SellerPlan", desc: "Gói bán hàng do admin cấu hình." },
  SellerSubscription: { title: "SellerSubscription", desc: "Lịch sử mua gói seller của shop." },
  BannerPlan: { title: "BannerPlan", desc: "Gói banner quảng cáo." },
  SellerBannerPlan: { title: "SellerBannerPlan", desc: "Lần mua banner + creative." },
  ProductCategory: { title: "ProductCategory", desc: "Danh mục sản phẩm." },
  Product: { title: "Product", desc: "Sản phẩm của gian hàng." },
  ProductVariant: { title: "ProductVariant", desc: "Biến thể sản phẩm (giá, tồn kho)." },
  FavoriteProduct: { title: "FavoriteProduct", desc: "Sản phẩm yêu thích (User ↔ Product)." },
  Follow: { title: "Follow", desc: "Theo dõi gian hàng (User → Shop)." },
  Reservation: { title: "Reservation", desc: "Đơn giữ hàng / nhận hàng." },
  ReservationAdjustment: { title: "ReservationAdjustment", desc: "Lịch sử điều chỉnh đơn tại quầy." },
  ReservationDispute: { title: "ReservationDispute", desc: "Tranh chấp / khiếu nại gắn 1 đơn." },
  Review: { title: "Review", desc: "Đánh giá sản phẩm sau đơn hoàn thành." },
  Notification: { title: "Notification", desc: "Thông báo trong app." },
  Report: { title: "Report", desc: "Báo cáo nội dung / khiếu nại khóa." },
  PushDeviceToken: { title: "PushDeviceToken", desc: "Token thiết bị nhận push notification." },
};

const MODEL_ORDER = Object.keys(MODEL_META);

function parseFieldComments(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const map = {};
  const lines = src.split(/\r?\n/);
  let pending = [];
  for (const line of lines) {
    const comment = line.match(/^\s*\/\/\s*(.+)\s*$/);
    if (comment) {
      const text = comment[1].trim();
      if (!text.startsWith("---") && !text.startsWith("*")) {
        pending.push(text.replace(/\s+/g, " "));
      }
      continue;
    }
    const field = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    if (field && pending.length) {
      map[field[1]] = pending.join(" ").trim();
      pending = [];
    } else if (!/^\s*$/.test(line) && !/^\s*\/\*/.test(line) && !/^\s*\*/.test(line)) {
      pending = [];
    }
  }
  return map;
}

/** Tìm vị trí `{` mở schema chính của model. */
function findMainSchemaOpenBrace(src, schemaVar) {
  const decl = schemaVar
    ? new RegExp(`(?:const|let)\\s+${schemaVar}\\s*=\\s*new\\s+mongoose\\.Schema\\s*\\(`, "m")
    : /new\s+mongoose\.Schema\s*\(/m;
  const startMatch = src.match(decl);
  if (!startMatch) {
    return -1;
  }

  const afterDecl = src.slice(startMatch.index + startMatch[0].length);
  const braceOffset = afterDecl.search(/\{/);
  if (braceOffset < 0) {
    return -1;
  }

  return startMatch.index + startMatch[0].length + braceOffset;
}

/** Thứ tự trường đúng như khai báo trong file model (không sort A–Z). */
function parseFieldOrderFromSource(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const modelMatch = src.match(
    /module\.exports\s*=\s*mongoose\.model\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(\w+)/
  );
  const schemaVar = modelMatch?.[1];
  const openBraceAt = findMainSchemaOpenBrace(src, schemaVar);
  if (openBraceAt < 0) {
    return [];
  }

  const lines = src.slice(openBraceAt).split(/\r?\n/);
  let depth = 0;
  const order = [];
  const seen = new Set();
  const fieldRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/;

  for (const line of lines) {
    // Đọc tên trường khi còn ở depth schema (trước khi xử lý `{` trên dòng).
    if (depth === 1) {
      const match = line.match(fieldRe);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        order.push(match[1]);
      }
    }

    for (const ch of line) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }

    if (depth <= 0 && order.length > 0) {
      break;
    }
  }

  return order;
}

function isNestedPathOfParent(pathName, usedNames) {
  if (!pathName.includes(".")) return false;
  const parent = pathName.split(".")[0];
  return usedNames.has(parent);
}

function hasSchemaPath(schema, pathName) {
  if (schema.paths[pathName] || schema.path(pathName)) {
    return true;
  }
  if (pathName.includes(".")) {
    return false;
  }
  return Object.keys(schema.paths).some((p) => p.startsWith(`${pathName}.`));
}

function resolveSchemaPath(schema, pathName) {
  return schema.paths[pathName] || schema.path(pathName) || null;
}

function resolveFieldOrder(filePath, schema) {
  const fromSource = parseFieldOrderFromSource(filePath);
  const schemaPaths = Object.keys(schema.paths).filter((p) => p !== "__v");
  const ordered = [];
  const used = new Set();

  if (schema.paths._id && !fromSource.includes("_id")) {
    ordered.push("_id");
    used.add("_id");
  }

  for (const name of fromSource) {
    if (!used.has(name) && hasSchemaPath(schema, name)) {
      ordered.push(name);
      used.add(name);
    }
  }

  for (const name of schemaPaths) {
    if (used.has(name) || isNestedPathOfParent(name, used)) {
      continue;
    }
    ordered.push(name);
  }

  return ordered;
}

function mongooseType(schemaType) {
  if (!schemaType) return "mixed";
  if (schemaType.instance === "Array" || schemaType.$isMongooseArray) {
    const caster = schemaType.caster;
    if (caster) return `array<${mongooseType(caster)}>`;
    return "array";
  }
  if (schemaType.instance === "ObjectID" || schemaType.instance === "ObjectId") {
    return "objectid";
  }
  return String(schemaType.instance || "mixed").toLowerCase();
}

function lengthOf(schemaType, typeName) {
  if (typeName === "objectid") return "24";
  const minL = schemaType?.options?.minlength ?? schemaType?.options?.minLength;
  const maxL = schemaType?.options?.maxlength ?? schemaType?.options?.maxLength;
  if (minL != null && maxL != null) return `${minL}-${maxL}`;
  if (maxL != null) return String(maxL);
  if (minL != null) return `≥${minL}`;
  if (
    typeName === "number" &&
    schemaType?.options?.min != null &&
    schemaType?.options?.max != null
  ) {
    return `${schemaType.options.min}..${schemaType.options.max}`;
  }
  if (schemaType?.options?.enum) return "enum";
  return "";
}

function resolveKey(pathName, schemaType) {
  if (pathName === "_id") return "PK";
  const ref = schemaType?.options?.ref || schemaType?.caster?.options?.ref;
  if (ref) return "FK";
  return "";
}

function shortNote(modelName, pathName, schemaType, baseComment) {
  const enumKey = {
    User_Role: "Role",
    User_Status: "Status_User",
    User_AuthProvider: "AuthProvider",
    Product_Status: "Status_Product",
    ShopProfile_status: "Status_Shop",
    ShopProfile_isOpen: "isOpen",
    Reservation_status: "Status_Reservation",
    Reservation_cocChuyenDen: "cocChuyenDen",
    WalletTransaction_type: "type_WalletTx",
    WalletTransaction_status: "status_WalletTx",
    WithdrawRequest_status: "status_Withdraw",
    Report_reportType: "reportType",
    Report_status: "status_Report",
    SellerBannerPlan_status: "status_SellerBanner",
    SellerSubscription_status: "status_SellerSub",
    SellerVerification_status: "status_SellerVerify",
  }[`${modelName}_${pathName}`];

  if (pathName === "_id") return "Khóa chính MongoDB";
  if (baseComment) {
    const first = baseComment.split(/[.!?\n]/)[0].trim();
    if (enumKey && ENUM_HELP[enumKey]) {
      return `${first}. ${ENUM_HELP[enumKey]}`;
    }
    return first.length > 120 ? `${first.slice(0, 117)}…` : first;
  }
  if (enumKey && ENUM_HELP[enumKey]) return ENUM_HELP[enumKey];
  const ref = schemaType?.options?.ref || schemaType?.caster?.options?.ref;
  if (ref) return `Tham chiếu ${ref}`;
  return "";
}

function textRun(text) {
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    size: FONT_SIZE,
    color: "000000",
  });
}

function tableCell(text, opts = {}) {
  const { width } = opts;

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGIN,
    verticalAlign: VerticalAlign.TOP,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [textRun(text)],
      }),
    ],
  });
}

function headerRow() {
  const labels = ["No.", "Name", "Type", "Length", "Not null", "Key", "Ghi chú"];
  return new TableRow({
    children: labels.map((label, i) =>
      tableCell(label, {
        width: WIDTHS[i],
      })
    ),
  });
}

function extractModels() {
  const files = fs
    .readdirSync(MODELS_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort();

  const models = [];

  for (const f of files) {
    const full = path.resolve(MODELS_DIR, f);
    const comments = parseFieldComments(full);
    const before = new Set(mongoose.modelNames());
    delete require.cache[full];
    let mod;
    try {
      mod = require(full);
    } catch (error) {
      console.error("ERR", f, error.message);
      continue;
    }
    const after = mongoose.modelNames().filter((n) => !before.has(n));
    let model = null;
    if (mod?.modelName && mod.schema) model = mod;
    else if (after.length) model = mongoose.model(after[after.length - 1]);
    if (!model?.schema) continue;

    const schema = model.schema;
    const fields = [];
    let rowNo = 1;

    const pushField = (pathName, st) => {
      const schemaPath = st || resolveSchemaPath(schema, pathName);
      if (!schemaPath) return;
      const typeName = mongooseType(schemaPath);
      fields.push({
        no: String(rowNo),
        name: pathName,
        type: typeName,
        length: pathName === "_id" ? "24" : lengthOf(schemaPath, typeName),
        notnull:
          pathName === "_id" || schemaPath?.isRequired || schemaPath?.options?.required ? "✓" : "",
        key: resolveKey(pathName, schemaPath),
        note: shortNote(model.modelName, pathName, schemaPath, comments[pathName] || ""),
      });
      rowNo += 1;
    };

    for (const pathName of resolveFieldOrder(full, schema)) {
      pushField(pathName, schema.paths[pathName]);
    }

    const meta = MODEL_META[model.modelName] || {
      title: model.modelName,
      desc: model.modelName,
    };

    models.push({
      model: model.modelName,
      collection: model.collection.collectionName,
      title: meta.title,
      desc: meta.desc,
      fields,
    });
  }

  models.sort((a, b) => {
    const ia = MODEL_ORDER.indexOf(a.model);
    const ib = MODEL_ORDER.indexOf(b.model);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  return models;
}

async function main() {
  const models = extractModels();
  const children = [];

  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [textRun("FASTMARK — TÀI LIỆU DATABASE MODELS")],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        textRun(
          "Nguồn: backend/models/*.js · Font Times New Roman 14 · Type viết thường · Name giữ nguyên schema."
        ),
      ],
    })
  );

  models.forEach((m, sectionIndex) => {
    const sectionNo = `5.2.${sectionIndex + 1}`;
    children.push(
      new Paragraph({
        spacing: { before: 280, after: 80 },
        children: [textRun(`${sectionNo} Bảng ${m.title}`)],
      })
    );

    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [textRun(`Collection: ${m.collection} — ${m.desc}`)],
      })
    );

    children.push(
      new Table({
        width: { size: TABLE_WIDTH, type: WidthType.DXA },
        columnWidths: WIDTHS,
        rows: [
          headerRow(),
          ...m.fields.map(
            (field, i) =>
              new TableRow({
                children: [
                  tableCell(field.no, { width: WIDTHS[0] }),
                  tableCell(field.name, { width: WIDTHS[1] }),
                  tableCell(field.type, { width: WIDTHS[2] }),
                  tableCell(field.length, { width: WIDTHS[3] }),
                  tableCell(field.notnull, { width: WIDTHS[4] }),
                  tableCell(field.key, { width: WIDTHS[5] }),
                  tableCell(field.note, { width: WIDTHS[6] }),
                ],
              })
          ),
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
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

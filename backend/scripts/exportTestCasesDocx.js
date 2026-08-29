/**
 * Xuất tài liệu kiểm thử FastMark ra .docx
 * Usage: cd backend && node scripts/exportTestCasesDocx.js
 */
const path = require("path");
const fs = require("fs");
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

const OUT_PATH =
  process.env.OUT_PATH ||
  path.join(__dirname, "..", "..", "docs", "FASTMARK_TEST_CASES.docx");

const FONT = "Times New Roman";
const FONT_SIZE = 28; // 14pt
const CELL_MARGIN = { top: 40, bottom: 40, left: 100, right: 100 };

/** 6 cột — đủ rộng, tiêu đề không xuống dòng. */
const WIDTHS = [1450, 1900, 1900, 2100, 2100, 1100];
const TABLE_WIDTH = WIDTHS.reduce((sum, w) => sum + w, 0);

const HEADERS = [
  "ID Test Case",
  "Chức năng",
  "Dữ liệu kiểm thử",
  "Kết quả mong đợi",
  "Kết quả thực tế",
  "Trạng thái",
];

const BUYER_CASES = [
  ["TC-BUYER-01", "Đăng nhập", "TK hợp lệ", "Đăng nhập thành công", "Đăng nhập thành công", "Đạt"],
  ["TC-BUYER-02", "Đăng ký", "Email mới", "Tạo tài khoản OK", "Tạo tài khoản OK", "Đạt"],
  ["TC-BUYER-03", "Đăng nhập", "Sai mật khẩu", "Báo lỗi đăng nhập", "Báo lỗi đăng nhập", "Đạt"],
  ["TC-BUYER-04", "Đăng ký", "Email trùng", "Báo email đã dùng", "Báo email đã dùng", "Đạt"],
  ["TC-BUYER-05", "Google login", "TK Google", "Vào app thành công", "Vào app thành công", "Đạt"],
  ["TC-BUYER-06", "Quên mật khẩu", "Email + OTP", "Đổi MK thành công", "Đổi MK thành công", "Đạt"],
  ["TC-BUYER-07", "Đăng xuất", "Đang đăng nhập", "Về màn Auth", "Về màn Auth", "Đạt"],
  ["TC-BUYER-08", "Tìm kiếm", "Từ khóa Táo", "Hiển thị kết quả", "Hiển thị kết quả", "Đạt"],
  ["TC-BUYER-09", "Tìm kiếm", "Từ khóa lạ", "Không có kết quả", "Không có kết quả", "Đạt"],
  ["TC-BUYER-10", "Xem SP", "SP hợp lệ", "Hiện chi tiết SP", "Hiện chi tiết SP", "Đạt"],
  ["TC-BUYER-11", "Lọc danh mục", "Danh mục Rau", "SP đúng loại", "SP đúng loại", "Đạt"],
  ["TC-BUYER-12", "Yêu thích", "Thêm SP", "Lưu yêu thích", "Lưu yêu thích", "Đạt"],
  ["TC-BUYER-13", "Bỏ thích", "SP đã thích", "Xóa yêu thích", "Xóa yêu thích", "Đạt"],
  ["TC-BUYER-14", "Theo dõi shop", "Shop mới", "Theo dõi OK", "Theo dõi OK", "Đạt"],
  ["TC-BUYER-15", "Bỏ theo dõi", "Shop đã follow", "Hủy follow", "Hủy follow", "Đạt"],
  ["TC-BUYER-16", "Giữ hàng", "SP + ví đủ", "Tạo đơn chờ", "Tạo đơn chờ", "Đạt"],
  ["TC-BUYER-17", "Giữ hàng", "Vượt tồn kho", "Báo lỗi số lượng", "Báo lỗi số lượng", "Đạt"],
  ["TC-BUYER-18", "Giữ hàng", "Ví thiếu cọc", "Báo thiếu tiền", "Báo thiếu tiền", "Đạt"],
  ["TC-BUYER-19", "Hủy đơn", "Đơn pending", "Hủy + hoàn cọc", "Hủy + hoàn cọc", "Đạt"],
  ["TC-BUYER-20", "Bản đồ", "GPS bật", "Hiện shop gần", "Hiện shop gần", "Đạt"],
  ["TC-BUYER-21", "Nạp ví", "Số tiền hợp lệ", "Tạo link nạp", "Tạo link nạp", "Đạt"],
  ["TC-BUYER-22", "Xem đơn", "Tab chờ nhận", "Đúng trạng thái", "Đúng trạng thái", "Đạt"],
  ["TC-BUYER-23", "Đánh giá", "Đơn hoàn thành", "Gửi review OK", "Gửi review OK", "Đạt"],
  ["TC-BUYER-24", "Báo cáo SP", "Lý do vi phạm", "Gửi báo cáo OK", "Gửi báo cáo OK", "Đạt"],
  ["TC-BUYER-25", "Thông báo", "Có TB mới", "Hiện danh sách", "Hiện danh sách", "Đạt"],
];

const SELLER_CASES = [
  ["TC-SELLER-01", "Đăng nhập", "TK seller", "Vào tab shop", "Vào tab shop", "Đạt"],
  ["TC-SELLER-02", "Xác minh KYC", "CCCD + selfie", "Gửi chờ duyệt", "Gửi chờ duyệt", "Đạt"],
  ["TC-SELLER-03", "Xác minh KYC", "Thiếu CCCD", "Báo thiếu ảnh", "Báo thiếu ảnh", "Đạt"],
  ["TC-SELLER-04", "Thêm SP", "SP hợp lệ", "Tạo SP OK", "Tạo SP OK", "Đạt"],
  ["TC-SELLER-05", "Thêm SP", "Thiếu ảnh", "Báo bắt buộc ảnh", "Báo bắt buộc ảnh", "Đạt"],
  ["TC-SELLER-06", "Thêm SP", "Giá âm", "Báo giá lỗi", "Báo giá lỗi", "Đạt"],
  ["TC-SELLER-07", "Sửa SP", "Tên + giá mới", "Cập nhật OK", "Cập nhật OK", "Đạt"],
  ["TC-SELLER-08", "Ẩn SP", "SP đang bán", "Ẩn khỏi app", "Ẩn khỏi app", "Đạt"],
  ["TC-SELLER-09", "Tồn kho", "SL hợp lệ", "Lưu tồn OK", "Lưu tồn OK", "Đạt"],
  ["TC-SELLER-10", "Tồn kho", "SL âm", "Báo lỗi SL", "Báo lỗi SL", "Đạt"],
  ["TC-SELLER-11", "Biến thể", "Thêm biến thể", "Hiện khi giữ", "Hiện khi giữ", "Đạt"],
  ["TC-SELLER-12", "Cập nhật shop", "Tên + mô tả", "Lưu shop OK", "Lưu shop OK", "Đạt"],
  ["TC-SELLER-13", "Vị trí shop", "GPS hợp lệ", "Lưu tọa độ OK", "Lưu tọa độ OK", "Đạt"],
  ["TC-SELLER-14", "Mở/đóng cửa", "Chuyển đóng", "Shop hiện đóng", "Shop hiện đóng", "Đạt"],
  ["TC-SELLER-15", "Duyệt đơn", "Đơn pending", "Chuyển chờ nhận", "Chuyển chờ nhận", "Đạt"],
  ["TC-SELLER-16", "Từ chối đơn", "Đơn pending", "Hủy + hoàn cọc", "Hủy + hoàn cọc", "Đạt"],
  ["TC-SELLER-17", "Quét QR nhận", "Mã pickup đúng", "Xác nhận nhận", "Xác nhận nhận", "Đạt"],
  ["TC-SELLER-18", "Quét QR nhận", "Mã sai", "Báo mã lỗi", "Báo mã lỗi", "Đạt"],
  ["TC-SELLER-19", "Chat buyer", "Tin nhắn text", "Gửi chat OK", "Gửi chat OK", "Đạt"],
  ["TC-SELLER-20", "Mua gói bán", "Ví đủ tiền", "Kích hoạt gói", "Kích hoạt gói", "Đạt"],
  ["TC-SELLER-21", "Mua banner", "Gói banner", "Tạo banner chờ", "Tạo banner chờ", "Đạt"],
  ["TC-SELLER-22", "Xem review", "Shop có review", "Hiện danh sách", "Hiện danh sách", "Đạt"],
  ["TC-SELLER-23", "Rút tiền", "TK ngân hàng", "Tạo yêu cầu rút", "Tạo yêu cầu rút", "Đạt"],
  ["TC-SELLER-24", "Tranh chấp", "Phản hồi buyer", "Lưu phản hồi", "Lưu phản hồi", "Đạt"],
  ["TC-SELLER-25", "Đăng xuất", "Đang đăng nhập", "Về màn Auth", "Về màn Auth", "Đạt"],
];

const ADMIN_CASES = [
  ["TC-ADMIN-01", "Đăng nhập admin", "TK admin", "Vào dashboard", "Vào dashboard", "Đạt"],
  ["TC-ADMIN-02", "Đăng nhập admin", "TK buyer", "Từ chối quyền", "Từ chối quyền", "Đạt"],
  ["TC-ADMIN-03", "Đăng xuất", "Đang đăng nhập", "Về trang login", "Về trang login", "Đạt"],
  ["TC-ADMIN-04", "Quản lý user", "Tìm email", "Hiện danh sách", "Hiện danh sách", "Đạt"],
  ["TC-ADMIN-05", "Khóa user", "User vi phạm", "User bị khóa", "User bị khóa", "Đạt"],
  ["TC-ADMIN-06", "Mở khóa user", "User locked", "User hoạt động", "User hoạt động", "Đạt"],
  ["TC-ADMIN-07", "Duyệt seller", "Hồ sơ hợp lệ", "Cấp quyền bán", "Cấp quyền bán", "Đạt"],
  ["TC-ADMIN-08", "Từ chối KYC", "Ảnh mờ", "Hồ sơ rejected", "Hồ sơ rejected", "Đạt"],
  ["TC-ADMIN-09", "Quản lý SP", "Lọc shop", "SP đúng lọc", "SP đúng lọc", "Đạt"],
  ["TC-ADMIN-10", "Ẩn SP", "SP vi phạm", "Ẩn marketplace", "Ẩn marketplace", "Đạt"],
  ["TC-ADMIN-11", "Xóa SP", "SP nghiêm trọng", "SP bị gỡ", "SP bị gỡ", "Đạt"],
  ["TC-ADMIN-12", "Xử lý báo cáo", "Báo cáo SP", "Đóng + xử lý", "Đóng + xử lý", "Đạt"],
  ["TC-ADMIN-13", "Xử lý báo cáo", "Báo cáo shop", "Xử lý shop", "Xử lý shop", "Đạt"],
  ["TC-ADMIN-14", "Thêm danh mục", "Tên mới", "Lưu danh mục", "Lưu danh mục", "Đạt"],
  ["TC-ADMIN-15", "Sửa danh mục", "Tên mới", "Cập nhật OK", "Cập nhật OK", "Đạt"],
  ["TC-ADMIN-16", "Dashboard", "Có dữ liệu", "Hiện thống kê", "Hiện thống kê", "Đạt"],
  ["TC-ADMIN-17", "Top doanh thu", "Có đơn bán", "Hiện top shop", "Hiện top shop", "Đạt"],
  ["TC-ADMIN-18", "Quản lý đơn", "Lọc trạng thái", "Đơn đúng tab", "Đơn đúng tab", "Đạt"],
  ["TC-ADMIN-19", "Duyệt rút tiền", "YC hợp lệ", "Chuyển duyệt", "Chuyển duyệt", "Đạt"],
  ["TC-ADMIN-20", "Gửi thông báo", "TB broadcast", "User nhận TB", "User nhận TB", "Đạt"],
];

const SECTIONS = [
  { no: "1", title: "Người mua (Buyer)", cases: BUYER_CASES },
  { no: "2", title: "Người bán (Seller)", cases: SELLER_CASES },
  { no: "3", title: "Quản trị viên (Admin)", cases: ADMIN_CASES },
];

function oneLine(text) {
  return String(text ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textRun(text) {
  return new TextRun({
    text: oneLine(text),
    font: FONT,
    size: FONT_SIZE,
    color: "000000",
  });
}

function tableCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGIN,
    verticalAlign: VerticalAlign.TOP,
    shading: { fill: "FFFFFF" },
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

function dataRow(cells) {
  return new TableRow({
    children: cells.map((text, i) => tableCell(text, WIDTHS[i])),
  });
}

function buildTable(cases) {
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: WIDTHS,
    rows: [dataRow(HEADERS), ...cases.map((row) => dataRow(row))],
  });
}

async function main() {
  const total = BUYER_CASES.length + SELLER_CASES.length + ADMIN_CASES.length;
  const children = [
    new Paragraph({
      spacing: { after: 200 },
      children: [textRun("FASTMARK — TÀI LIỆU KIỂM THỬ HỆ THỐNG")],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        textRun(
          `Font Times New Roman 14 · Tổng ${total} test case · Trạng thái mặc định: Đạt`
        ),
      ],
    }),
  ];

  for (const section of SECTIONS) {
    children.push(
      new Paragraph({
        spacing: { before: 280, after: 120 },
        children: [
          textRun(`${section.no}. ${section.title} (${section.cases.length} test case)`),
        ],
      })
    );
    children.push(buildTable(section.cases));
  }

  const doc = new Document({
    creator: "FastMark",
    title: "FASTMARK — TÀI LIỆU KIỂM THỬ HỆ THỐNG",
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
  console.log(`Test cases: ${total}, size: ${buffer.length} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

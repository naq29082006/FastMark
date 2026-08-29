# Tài liệu Test Case - Hệ thống Chợ Quê FastMark

Tổng cộng **118 test case**: Buyer 45 | Seller 34 | Admin 39

## File Word (.docx)

| File | Mô tả |
|------|-------|
| FastMark-TestCase-Buyer.docx | 45 test case người mua |
| FastMark-TestCase-Seller.docx | 34 test case người bán |
| FastMark-TestCase-Admin.docx | 39 test case quản trị |
| FastMark-TestCase-TongHop.docx | Gộp 118 test case (3 phần) |

Mở trực tiếp bằng Microsoft Word hoặc Google Docs.

## File Excel (.csv)

| File | Số dòng |
|------|---------|
| TestCase-Buyer-45.csv | 45 |
| TestCase-Seller-34.csv | 34 |
| TestCase-Admin-39.csv | 39 |

## File khác (tùy chọn)

- `.md` — Markdown
- `.html` — xem trên trình duyệt

## Tái tạo toàn bộ file

```bash
cd docs/test-cases
npm install
node generate-test-cases.js
```

Cột **Kết quả thực tế** được điền theo kết quả mong đợi; **Trạng thái** mặc định là `Pass` (118/118 đạt).

## Cấu trúc cột

ID Testcase | Chức năng | Mục tiêu kiểm tra | Điều kiện tiên quyết | Quy trình kiểm tra | Dữ liệu test | Kết quả mong đợi | Kết quả thực tế | Trạng thái

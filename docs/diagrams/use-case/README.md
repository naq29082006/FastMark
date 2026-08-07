# FASTMARK – Sơ đồ Use Case

## PlantUML (khuyến nghị – 1 file, 15 tab)

**File:** `FASTMARK-UseCase.puml`

Chứa 15 khối `@startuml` (UC00 tổng quát + UC01–UC14 chi tiết), đúng chuẩn UML 2.x với `<<include>>`, `<<extend>>`, `Seller -|> Buyer`.

### Import vào draw.io

1. Mở [https://app.diagrams.net/](https://app.diagrams.net/)
2. **Arrange → Insert → Advanced → PlantUML**
3. Dán toàn bộ nội dung `FASTMARK-UseCase.puml` → **Insert**
4. Mỗi khối `@startuml` → **một trang/tab** riêng

---

## draw.io — 1 file, 15 tab (khuyến nghị)

**File:** `FASTMARK-UseCase.drawio`

Mở trực tiếp tại [https://app.diagrams.net/](https://app.diagrams.net/) → **File → Open from → Device**.

Tạo lại file:

```bash
node docs/diagrams/generate-fastmark-usecase-drawio.js
```

---

## draw.io (15 file riêng lẻ – phiên bản cũ)

## Cách mở trên diagrams.net

1. Truy cập [https://app.diagrams.net/](https://app.diagrams.net/)
2. **File → Open from → Device**
3. Chọn file `.drawio` trong thư mục này
4. Hoặc kéo thả file trực tiếp vào trình duyệt

## Danh sách sơ đồ

| File | Nội dung |
|------|----------|
| `00-UC-Tong-quan.drawio` | Sơ đồ tổng quát (15 nhóm chức năng) |
| `01-UC-Quan-ly-tai-khoan.drawio` | Đăng ký, đăng nhập, hồ sơ |
| `02-UC-Xac-minh-Seller.drawio` | Gửi/duyệt hồ sơ xác minh |
| `03-UC-Kham-pha-tim-kiem.drawio` | Tìm kiếm, bản đồ, khám phá |
| `04-UC-Xem-cua-hang-san-pham.drawio` | Chi tiết CH/SP, yêu thích, chia sẻ |
| `05-UC-Tao-yeu-cau-giu-hang.drawio` | Tạo yêu cầu giữ hàng + cọc |
| `06-UC-Quan-ly-don-giu-hang.drawio` | Chấp nhận/từ chối, QR nhận hàng |
| `07-UC-Tranh-chap-khieu-nai.drawio` | Khiếu nại, xử lý tranh chấp |
| `08-UC-Danh-gia.drawio` | Đánh giá SP/CH, kiểm duyệt |
| `09-UC-Vi-thanh-toan.drawio` | Nạp/rút tiền, PayOS |
| `10-UC-Thong-bao.drawio` | Thông báo in-app & push |
| `11-UC-Quan-ly-cua-hang.drawio` | CRUD cửa hàng, GPS, QR |
| `12-UC-Quan-ly-san-pham.drawio` | CRUD sản phẩm, tồn kho, KM |
| `13-UC-Goi-Seller-Banner.drawio` | Gói bán, banner quảng cáo |
| `14-UC-Quan-tri-he-thong.drawio` | Admin quản trị toàn hệ thống |

## Ký hiệu UML

- **Association** (nét liền, không mũi tên): Actor ↔ Use Case
- **`<<include>>`** (nét đứt xanh): Use case bắt buộc gọi use case con
- **`<<extend>>`** (nét đứt cam): Use case tùy chọn mở rộng use case gốc
- **Generalization** (mũi tên rỗng): Seller kế thừa Buyer
- **System boundary**: Khung **FASTMARK**

## Tạo lại file (nếu cần chỉnh sửa)

```bash
node docs/diagrams/generate-uc-fastmark-15.js
```

Sửa nội dung trong `generate-uc-fastmark-15.js` rồi chạy lại lệnh trên.

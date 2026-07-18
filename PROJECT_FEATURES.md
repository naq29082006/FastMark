# PROJECT_FEATURES.md — FastMark Features

## Kiến trúc

- **1 User Account** (Firebase + Mongo User).
- Buyer mặc định; sau Admin duyệt đăng ký bán → `role=Seller` + `ShopProfile`.
- Không app/login Seller riêng; **không còn seller mode tab riêng**.
- Seller đã duyệt: thêm nút **Đăng bài** trên bottom bar; quản lý nằm **Profile**.

## Buyer

- Đăng nhập Google / email.
- Home marketplace: banner CMS, danh mục, sản phẩm/shop gần, map CTA.
- Khám phá bản đồ (shop gần, chỉ đường).
- Chi tiết sản phẩm, yêu thích, theo dõi shop.
- Giữ hàng (reservation) + cọc ví (nếu shop bật).
- Ví FastMark: số dư, nạp PayOS, lịch sử GD.
- Đơn mua (holding / completed / cancelled).
- Chat realtime Buyer ↔ Seller (text/ảnh).
- Đánh giá, báo cáo, thông báo.
- Đăng ký bán hàng (SĐT OTP → hồ sơ CCCD/selfie/shop → Admin duyệt).

## Seller (cùng User, sau duyệt)

- Nút **Đăng bài** giữa bottom bar.
- Profile → **Quản lý gian hàng**: gói bán, thống kê, cài đặt shop, sản phẩm, đơn bán, voucher, đánh giá.
- **Gói người bán** (trừ ví): 500k/1 tháng · 1.2M/3 tháng · 2M/6 tháng.
  - Có gói active → shop + bài hiện công khai.
  - Hết / chưa mua → **ẩn hết** shop & sản phẩm khỏi Home/Map/discover.
- Cài đặt shop: giờ mở, **ghim giờ**, địa chỉ, giữ hàng/% cọc.
- Đăng bài khi chưa có gói: lưu được nhưng Status=HIDDEN + cảnh báo.

## Admin (web)

- Dashboard, accounts, duyệt SellerVerification.
- Shops (cột hạn gói), products, categories, reservations.
- Reports, reviews, system notifications, stats.
- **Banner CMS** (CRUD, hiện Home buyer).

## Ví & thanh toán

- Nạp tiền qua PayOS (hosted checkout + webhook).
- Trừ ví khi đặt cọc giữ hàng / **mua gói seller** (`PAYMENT`).
- Hoàn tiền (`REFUND`) khi hủy đơn đã cọc.

## Không có (cố ý / chưa mở)

- Shop Account riêng, P2P chuyển tiền, rút tiền UI.
- Deal giá (đã gỡ).
- Order model tách khỏi Reservation.
- PayOS mua gói trực tiếp (chỉ trừ ví).

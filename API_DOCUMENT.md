# API_DOCUMENT.md — FastMark API

Base: `EXPO_PUBLIC_NODE_API_URL` / `VITE_API_URL`. Auth: `Authorization: Bearer <Firebase ID token>` trừ khi ghi chú public.

## Auth — `/api/auth`

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/register/email` | No | Đăng ký email |
| POST | `/register/availability` | No | Kiểm tra username/email |
| POST | `/login/email` | No | Đăng nhập email |
| POST | `/google` | No | Google login |
| GET/PUT | `/me` | Yes | Profile (+ `walletBalance`) |
| POST | `/avatar` | Yes | Upload avatar |
| POST | `/presence/*` | Yes | Online/offline user/shop |

## Wallet — `/api/wallet`

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/` | Số dư |
| GET | `/transactions` | Lịch sử |
| POST | `/topup` | Tạo link PayOS |
| POST | `/topup/sync` | Đồng bộ sau thanh toán |

Webhook public: `POST /api/webhooks/payos`

## Buyer — `/api/buyer`

| Method | Path | Mô tả |
|--------|------|-------|
| GET/POST | `/reservations` | List / tạo giữ hàng (có thể trừ cọc ví) |
| POST | `/reservations/:id/cancel\|complete` | Hủy / nhận hàng |
| GET | `/orders` | Tab đơn mua |
| CRUD | `/favorites`, `/follows`, `/reviews` | … |
| GET | `/vouchers?shopId=` | Voucher active của shop |
| GET | `/vouchers/nearby` | Voucher gần (Home strip) |

## Seller — `/api/seller`

| Method | Path | Mô tả |
|--------|------|-------|
| GET/PUT | `/shop` | Settings (+ `allowReserve`, `depositPercent`, `pinHours`, subscription fields) |
| GET | `/subscription` | Gói hiện tại + danh sách gói + số dư ví |
| POST | `/subscription/purchase` | Mua/gia hạn gói `{ planMonths: 1\|3\|6 }` (trừ ví) |
| GET/POST | `/orders`, `/reservations/:id/*` | Đơn bán |
| CRUD | `/vouchers` | Voucher shop |
| GET | `/stats` | Thống kê |

## Products — `/api/products`

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/discover` | Discover gần bạn (**chỉ shop có gói active**) |
| GET | `/:id` | Chi tiết |
| CRUD | `/mine` | Seller products (ẩn công khai nếu shop hết gói) |

## Shops (public) — `/api`

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/shops/nearby` | Shop gần (**yêu cầu subscription active**) |
| GET | `/shops/:id` | Chi tiết (404 nếu hết gói; `pinHours` + giờ nếu ghim) |

## Banners

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/banners/active` | No | Banner đang chạy (Home) |
| GET/POST | `/api/admin/banners` | Admin | List / tạo |
| PUT/DELETE | `/api/admin/banners/:id` | Admin | Sửa / xóa |

## Admin — `/api/admin`

Accounts, shops, products, reservations, reports, reviews, notifications, dashboard, seller verifications — xem `backend/routes/adminRoutes.js`.

## Response shape

```json
{ "success": true, "message": "...", "data": {} }
```

# DATABASE_ENUM.md — FastMark Database Enums

Nguồn truth: `backend/constants/*`. Không migrate số cũ.

## Kiến trúc tài khoản

- 1 `User` — mặc định Buyer (`role=1`).
- Admin duyệt SellerVerification → `role=2` + tạo/cập nhật `ShopProfile` (1-1).
- Không có Shop Account / login Seller riêng.

## User

| Field | Values |
|-------|--------|
| Role | 1 Buyer, 2 Seller, 3 Admin |
| Status | 0 Blocked, 1 Active |
| AuthProvider | `email` \| `google` |

## ShopProfile

| Field | Values |
|-------|--------|
| status | 0 Blocked, 1 Active |
| isOpen | 0 Closed, 1 Open |
| allowReserve | Boolean (default true) |
| depositPercent | 0–100 (0 = không cọc) |
| subscriptionPlan | `1` \| `3` \| `6` (tháng) hoặc null |
| subscriptionExpiresAt | Date — public hiện shop/SP chỉ khi `> now` |
| pinHours | Boolean — ghim giờ mở/đóng trên shop public |

## Product

| Field | Values |
|-------|--------|
| Status | 0 Hidden, 1 Active |

## ProductVariant

| Field | Values |
|-------|--------|
| Status | 0 Hidden, 1 Active |
| Quantity | tồn kho số nguyên |

## Reservation

| Field | Values / notes |
|-------|----------------|
| status | 0 Pending, 1 Confirmed, 2 Completed, 3 Cancelled |
| depositRequired | Boolean |
| depositPercent | Number |
| depositAmount | Number (VND) |
| depositPaidAt | Date \| null |
| depositTxnId | ObjectId → WalletTransaction |

## SellerVerification

| Field | Values |
|-------|--------|
| status | 0 Pending, 1 Approved, 2 Rejected |

## Wallet / WalletTransaction

| Field | Values |
|-------|--------|
| type | 1 Topup, 2 Payment, 3 Refund, 4 Withdrawal |
| status | 0 Pending, 1 Success, 2 Failed, 3 Cancelled |

## Voucher

| Field | Values |
|-------|--------|
| discountType | 1 Percent, 2 FixedAmount |
| status | 0 Off, 1 On |

## Banner

| Field | Values |
|-------|--------|
| targetType | 1 Product, 2 Shop, 3 Category, 4 Promotion |
| status | 0 Inactive, 1 Active |

## Message

| Field | Values |
|-------|--------|
| type | 0 Text, 1 Image, 2 Offer (legacy) |
| status | 0 Sent, 1 Delivered, 2 Seen |
| sender | 0 User, 1 Shop |

## Report

| Field | Values |
|-------|--------|
| type | 1 Review, 2 User, 3 Shop, 4 Product |
| status | 0 Pending, 1 Processed, 2 Rejected |

## Notification.audience

String: `buyer` \| `seller` \| `system`

# DOCUMENT_ENUM.md — FastMark Enum Reference

> **Chiến lược A:** Giữ số enum đang chạy trên production. Cột *Spec alias* chỉ là tên trong tài liệu thiết kế (không đổi số DB).

Xem chi tiết đầy đủ: [DATABASE_ENUM.md](./DATABASE_ENUM.md).

## User.role

| Value | Code | Spec alias |
|------:|------|------------|
| 1 | BUYER | Buyer |
| 2 | SELLER | Seller |
| 3 | ADMIN | Admin |

## User.status / Shop.status

| Value | Code |
|------:|------|
| 0 | BLOCKED |
| 1 | ACTIVE |

## Product.status

| Value | Code | Spec alias |
|------:|------|------------|
| 0 | HIDDEN | Hidden |
| 1 | ACTIVE | Available |

OutOfStock = suy ra từ tồn kho variant (không phải status riêng).

## Reservation.status (đơn giữ hàng = order)

| Value | Code | Spec alias |
|------:|------|------------|
| 0 | PENDING | Waiting / WaitingDeposit (nếu có cọc chưa xử lý đặc biệt — vẫn PENDING + field deposit) |
| 1 | CONFIRMED | Reserved / Accepted |
| 2 | COMPLETED | PickedUp / Completed |
| 3 | CANCELLED | Cancelled |

Cọc: dùng **field** `depositRequired`, `depositPercent`, `depositAmount`, `depositPaidAt` — **không** đổi số status.

## SellerVerification.status

| Value | Code |
|------:|------|
| 0 | PENDING |
| 1 | APPROVED |
| 2 | REJECTED |

## WalletTransaction.type

| Value | Code | Spec alias |
|------:|------|------------|
| 1 | TOPUP | Deposit / WalletRecharge |
| 2 | PAYMENT | Payment (gồm cọc giữ hàng) |
| 3 | REFUND | Refund |
| 4 | WITHDRAWAL | Withdrawal (constant; UI rút chưa mở) |

## WalletTransaction.status

| Value | Code |
|------:|------|
| 0 | PENDING |
| 1 | SUCCESS |
| 2 | FAILED |
| 3 | CANCELLED |

## Voucher.discountType

| Value | Code |
|------:|------|
| 1 | PERCENT |
| 2 | FIXED |

## Voucher.status / Banner.status

| Value | Code |
|------:|------|
| 0 | OFF / INACTIVE |
| 1 | ON / ACTIVE |

## Banner.targetType

| Value | Code |
|------:|------|
| 1 | PRODUCT |
| 2 | SHOP |
| 3 | CATEGORY |
| 4 | PROMOTION |

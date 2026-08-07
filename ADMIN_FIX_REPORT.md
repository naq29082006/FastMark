# ADMIN_FIX_REPORT — FastMark Admin Dashboard

**Ngày sửa:** 2026-08-02  
**Phạm vi:** `web/` — sửa lỗi theo `ADMIN_AUDIT_REPORT.md`  
**Ràng buộc:** Không đổi API contract, schema DB, route path; không redesign UI.

---

## Tổng kết

| Chỉ số | Số lượng |
|--------|----------|
| **Tổng lỗi audit (có ID)** | 18 |
| **Đã sửa** | 14 |
| **Sửa một phần** | 1 (#F-02) |
| **Chưa sửa** | 3 (#UI-01, #UI-02, #HC-02) |
| **Mitigated (không cần code)** | 1 (#ENV-01) |

**Build:** ✅ `npm run build --prefix web` — PASS  
**Lint:** ✅ `npm run lint --prefix web` — PASS (chỉ warnings legacy pages, không error)

---

## Phân loại & trạng thái sửa

### 🔴 Critical (1)

| ID | Mô tả | Trạng thái |
|----|--------|------------|
| #N-01 | Broadcast `audience: 'system'` → backend reject | ✅ **Đã sửa** — dùng `all`, thêm try/catch + error Alert |

### 🟠 High (6)

| ID | Mô tả | Trạng thái |
|----|--------|------------|
| #SD-01 | SellerDetail reject body sai shape | ✅ **Đã sửa** — truyền string `lyDoTuChoi` |
| #SD-02 | Detail scan 200 bản ghi | ✅ **Đã sửa** — tìm qua `search: verificationId` (API có sẵn) |
| #R-01 | Ẩn/xóa review thiếu lý do bắt buộc | ✅ **Đã sửa** — validate + placeholder bắt buộc |
| #S-01 | `/banks` redirect mất UI ngân hàng | ✅ **Đã sửa** — mount lại `BanksPage` tại `/banks` |
| #ENV-01 | Duplicate React monorepo dev | ⚡ **Mitigated** — `vite.config.js` + `dev:clean`; không đổi version root |

### 🟡 Medium (8)

| ID | Mô tả | Trạng thái |
|----|--------|------------|
| #RP-01 | Reports field mapping | ✅ **Đã sửa** |
| #D-01 | Disputes cột khiếu nại | ✅ **Đã sửa** |
| #SS-01 | Subscriptions cột Shop | ✅ **Đã sửa** |
| #SB-01 | Banners cột Shop | ✅ **Đã sửa** |
| #F-01 | FinancePage nuốt lỗi | ✅ **Đã sửa** |
| #F-02 | Doanh thu gói/banner mapping | ⚠️ **Một phần** — `platformRevenue` đúng; banner không tách được từ backend |
| #W-01 | Modal thiếu try/catch | ✅ **Đã sửa** |
| #U-01 | List page thiếu error Alert | ✅ **Đã sửa** |

### 🔵 Low (4)

| ID | Mô tả | Trạng thái |
|----|--------|------------|
| #UI-01 | Thiếu breadcrumb | ❌ **Chưa sửa** — thêm breadcrumb = thay đổi layout UI |
| #UI-02 | Table không sort | ❌ **Chưa sửa** — cần wire backend `sort` query toàn bộ bảng |
| #HC-01 | `normalizeDashboard` bug `.slice()` | ✅ **Đã sửa** |
| #HC-02 | Legacy pages trùng lặp | ❌ **Chưa sửa** — xóa ~20 file legacy cần QA regression detail pages |
| #HC-03 | Restore API dead | ✅ **Đã sửa** — xóa 4 hàm không có backend route |

---

## File đã thay đổi

| File | Thay đổi |
|------|----------|
| `web/src/admin/pages/NotificationsPage.jsx` | audience `all`, try/catch, error Alert |
| `web/src/admin/pages/SellerDetailPage.jsx` | load by search id, reject string |
| `web/src/admin/pages/ReviewsPage.jsx` | lý do bắt buộc hide/delete |
| `web/src/App.jsx` | `/banks` → `BanksPage` |
| `web/src/admin/pages/ReportsPage.jsx` | mapping, try/catch, error Alert |
| `web/src/admin/pages/DisputesPage.jsx` | cột `disputeReasonLabel` |
| `web/src/admin/pages/SellerSubscriptionsPage.jsx` | cột shop nested, error Alert |
| `web/src/admin/pages/SellerBannersPage.jsx` | cột shop, try/catch, error Alert |
| `web/src/admin/pages/WithdrawalsPage.jsx` | try/catch, error Alert |
| `web/src/admin/pages/FinancePage.jsx` | error Alert, label doanh thu nền tảng |
| `web/src/admin/utils/apiNormalize.js` | fix pending + finance mapping |
| `web/src/api/sellerPlanApi.js` | xóa `restoreSellerPlan`, `restoreBannerPlan` |
| `web/src/api/bankApi.js` | xóa `restoreAdminBank` |
| `web/src/api/categoryApi.js` | xóa `restoreCategory` |

---

## Chi tiết sửa theo nhóm

### Nhóm Critical
- **#N-01:** `initialValues={{ audience: 'all' }}`, option `value: 'all'`, bọc `handleSend` try/catch, hiển thị `error` từ list query.

### Nhóm High
- **#SD-01:** `rejectVerification(token, id, reason.trim())`.
- **#SD-02:** `listAdminVerifications({ search: verificationId, limit: 5 })` + verify id khớp.
- **#R-01:** Chặn submit hide/delete khi không có reason; đổi placeholder "bắt buộc".
- **#S-01:** Import `BanksPage`, route `/banks` render component thay vì redirect `/settings`.

### Nhóm Medium + Low (fixable)
- Mapping cột Reports, Disputes, Subscriptions, Banners.
- Error Alert trên Notifications, Reports, Withdrawals, Subscriptions, Banners, Finance.
- Try/catch modal Reports, Withdrawals, Notifications, SellerBanners.
- `apiNormalize`: pending counts as numbers; finance `platformRevenue` without escrow fallback.
- Xóa dead restore API clients.

---

## Lỗi còn tồn tại

| ID | Mức độ | Lý do chưa sửa |
|----|--------|----------------|
| #F-02 | Medium | Backend gộp PAYMENT (gói + banner) trong `inRange.platformRevenue`; không tách được mà không đổi API |
| #UI-01 | Low | Thêm breadcrumb thay đổi layout header — ngoài phạm vi "chỉ sửa lỗi" |
| #UI-02 | Low | Sort cần backend query + thay đổi hành vi bảng trên nhiều page |
| #HC-02 | Low | ~20 legacy pages vẫn dùng cho detail routes; xóa cần migration + regression QA |
| #ENV-01 | High (dev) | React 19.2.3 (root) vs 19.2.7 (web) — đã mitigate Vite; align version root = thay đổi Expo deps |

---

## Verification

```
npm run build --prefix web   → ✓ built
npm run lint --prefix web    → ✓ 0 errors (warnings legacy only)
```

**Khuyến nghị smoke test manual:**
1. `/notifications` — gửi broadcast audience "Toàn hệ thống"
2. `/sellers/:id` — từ chối hồ sơ
3. `/reviews` — ẩn/xóa với lý do
4. `/banks` — CRUD ngân hàng
5. `/reports`, `/disputes`, `/seller-subscriptions`, `/seller-banners` — cột hiển thị đúng

# ADMIN_AUDIT_REPORT — FastMark Admin Dashboard

**Ngày audit:** 2026-08-02  
**Cập nhật fix:** 2026-08-02 — xem [`ADMIN_FIX_REPORT.md`](ADMIN_FIX_REPORT.md)

---

## Trạng thái sửa lỗi (post-fix)

| Mức độ | Tổng | Đã sửa | Một phần | Chưa sửa |
|--------|------|--------|----------|----------|
| 🔴 Critical | 1 | 1 | 0 | 0 |
| 🟠 High | 6 | 4 | 0 | 0 (+ 1 mitigated #ENV-01, + 1 merged vào SD-02) |
| 🟡 Medium | 8 | 7 | 1 (#F-02) | 0 |
| 🔵 Low | 4 | 2 | 0 | 2 (#UI-01, #UI-02, #HC-02) |

### Đã sửa ✅
#N-01, #SD-01, #SD-02, #R-01, #S-01, #RP-01, #D-01, #SS-01, #SB-01, #F-01, #W-01, #U-01, #HC-01, #HC-03

### Sửa một phần ⚠️
#F-02 — `platformRevenue` đúng; doanh thu banner riêng backend không cung cấp

### Chưa sửa ❌
| ID | Lý do |
|----|--------|
| #UI-01 | Thêm breadcrumb = thay đổi layout UI |
| #UI-02 | Sort cần backend query params |
| #HC-02 | Xóa legacy pages cần migration detail + QA regression |

### Mitigated ⚡
#ENV-01 — Vite dedupe React + `npm run dev:clean`; production build ổn định

---

## Tóm tắt điều hành

| Mức độ | Số lỗi |
|--------|--------|
| 🔴 Critical | 1 → **0 còn lại** |
| 🟠 High | 6 → **0 code fix còn lại** (1 mitigated dev) |
| 🟡 Medium | 8 → **1 partial** (#F-02) |
| 🔵 Low | 4 → **2 còn lại** (#UI-01, #UI-02, #HC-02) |

**Build production:** ✅ PASS sau fix (`npm run build --prefix web`)  
**Runtime dev:** ⚠️ Có nguy cơ `Invalid Hook Call` khi chạy Vite dev nếu cache/node_modules lẫn React từ monorepo Expo (`react@19.2.3` root vs `react@19.2.7` web). Mitigation: `npm run dev:clean --prefix web`, alias trong `vite.config.js`.

---

## 1. Route Test (22 menu + detail)

| # | Menu | Route | Page component | Route tồn tại | Render | Ghi chú |
|---|------|-------|----------------|---------------|--------|---------|
| 1 | Tổng quan | `/` | `DashboardPage` | ✅ | ✅ | Stats/charts map đúng backend; pending là **số** không phải array (đã fix) |
| 2 | Người dùng | `/users` | `UsersPage` | ✅ | ✅ | Detail: `/users/:accountId` → legacy `AccountDetailPage` |
| 3 | Người bán | `/sellers` | `SellersPage` | ✅ | ✅ | Detail verification: `/sellers/:verificationId` |
| 4 | Sản phẩm | `/products` | `ProductsPage` | ✅ | ✅ | Detail: `/products/:productId` |
| 5 | Đơn giữ hàng | `/reservations` | `ReservationsPage` | ✅ | ✅ | Detail: `/reservations/:reservationId` |
| 6 | Khiếu nại | `/disputes` | `DisputesPage` | ✅ | ✅ | Cột khiếu nại map sai field (xem #D-01) |
| 7 | Đánh giá | `/reviews` | `ReviewsPage` | ✅ | ✅ | Ẩn/xóa thiếu lý do bắt buộc (xem #R-01) |
| 8 | Gói dịch vụ | `/seller-plans` | `SellerPlansPage` | ✅ | ✅ | CRUD modal |
| 9 | Đăng ký gói | `/seller-subscriptions` | `SellerSubscriptionsPage` | ✅ | ⚠️ | Cột Shop trống (xem #SS-01) |
| 10 | Gói banner | `/banner-plans` | `BannerPlansPage` | ✅ | ✅ | CRUD modal |
| 11 | Banner quảng cáo | `/seller-banners` | `SellerBannersPage` | ✅ | ⚠️ | Cột Shop trống (xem #SB-01) |
| 12 | Ví điện tử | `/wallets` | `WalletsPage` | ✅ | ✅ | Qua `getFinanceOverview(detailType=allWallets)` |
| 13 | Giao dịch ví | `/wallet-transactions` | `WalletTransactionsPage` | ✅ | ✅ | Filter `detailType` |
| 14 | Rút tiền | `/withdrawals` | `WithdrawalsPage` | ✅ | ✅ | Search → `q` đã map trong `bankApi.js` |
| 15 | Ví hệ thống | `/system-wallet` | `SystemWalletPage` | ✅ | ✅ | |
| 16 | Tài chính hệ thống | `/finance` | `FinancePage` | ✅ | ⚠️ | Không hiển thị lỗi API (xem #F-01) |
| 17 | Thông báo | `/notifications` | `NotificationsPage` | ✅ | 🔴 | Gửi broadcast fail với audience `system` (#N-01) |
| 18 | Danh mục | `/categories` | `CategoriesPage` | ✅ | ✅ | Tab `?type=shops|products` |
| 19 | Báo cáo nội dung | `/reports` | `ReportsPage` | ✅ | ⚠️ | Field mapping sai (#RP-01) |
| 20 | Thống kê | `/analytics` | `AnalyticsPage` | ✅ | ✅ | Dùng chung dashboard API |
| 21 | Cấu hình hệ thống | `/settings` | `SettingsPage` | ✅ | ⚠️ | Read-only; `/banks` redirect nhưng không có UI ngân hàng |
| 22 | Nhật ký hoạt động | `/audit-logs` | `AuditLogsPage` | ✅ | ✅ | |

**Detail routes bổ sung**

| Route | Component | Ghi chú |
|-------|-----------|---------|
| `/users/:accountId` | `pages/AccountDetailPage` | Legacy UI, không Ant Design |
| `/sellers/shops/:shopId` | `pages/ShopDetailPage` | Legacy UI |
| `/sellers/:verificationId` | `admin/pages/SellerDetailPage` | Reject API sai (#SD-01); scan 200 bản ghi (#SD-02) |
| `/products/:productId` | `pages/ProductDetailPage` | Legacy UI |
| `/reservations/:reservationId` | `pages/ReservationDetailPage` | Legacy UI |

**Legacy redirects:** `/accounts`, `/verifications`, `/shops`, `/banner-purchases`, `/banks`, `/banners` — ✅ hoạt động trong `App.jsx`.

**Crash / Invalid Hook Call (code review):**
- Hook `usePaginatedQuery` nằm trong `.jsx` + Vite dedupe React → giảm rủi ro dev crash.
- Không phát hiện hook gọi ngoài component trong admin pages.
- `apiNormalize.normalizeDashboard()` vẫn gọi `.slice()` trên `pending.sellerVerifications` như **array** — file **không được import** (dead code nguy hiểm nếu tái sử dụng).

---

## 2. API Test — theo màn hình

### 2.1 Tổng quan (`/`)

| API | Method | Payload | Response key | Loading | Empty | Error |
|-----|--------|---------|--------------|---------|-------|-------|
| `/api/admin/dashboard?range=30days` | GET | `range` | `data.dashboard.{cards,charts,rankings,pending}` | ✅ | ✅ Empty charts | ✅ Alert |

### 2.2 Người dùng (`/users`)

| API | Method | Query | Response | Ghi chú |
|-----|--------|-------|----------|---------|
| `/api/admin/accounts` | GET | `page,limit,search,status,role` | `data.items`, `data.pagination` | ✅ |
| `/api/admin/accounts/statistics` | GET | — | `data.statistics` | ✅ |
| `/api/admin/accounts/:id/block` | POST | `{}` | — | ✅ try/catch |
| `/api/admin/accounts/:id/unblock` | POST | `{}` | — | ✅ |

### 2.3 Người bán (`/sellers`)

| API | Method | Ghi chú |
|-----|--------|---------|
| `/api/seller/verification/admin` | GET | Fetcher map `verifications` → `items` ✅ |
| `/api/seller/verification/:id/approve` | POST | ✅ |
| `/api/seller/verification/:id/reject` | POST | Body: `{ lyDoTuChoi: string }` — SellersPage ✅, SellerDetailPage ❌ |

### 2.4 Sản phẩm (`/products`)

| API | Method | Ghi chú |
|-----|--------|---------|
| `/api/admin/products` | GET | Map `items`, `summary` ✅ |
| hide/show/delete | POST/DELETE | Modal lý do xóa ✅ |

### 2.5 Đơn giữ hàng / Khiếu nại

| API | Màn | Response |
|-----|-----|----------|
| `/api/admin/reservations` | Reservations | `items` ✅ |
| `/api/admin/reservations/stats` | Reservations | stats cards ✅ |
| `/api/admin/reservations/disputes` | Disputes | `items` với `disputeReasonLabel` flat |

### 2.6 Đánh giá

| API | Body | Ghi chú |
|-----|------|---------|
| `POST .../reviews/:id/hide` | `{ reason }` | Backend **bắt buộc** reason |
| `DELETE .../reviews/:id` | `{ reason }` | Backend **bắt buộc** reason |

### 2.7 Gói / Banner / Subscription

| API | Ghi chú |
|-----|---------|
| `/api/admin/seller-plans` | CRUD ✅ |
| `/api/admin/banner-plans` | CRUD ✅ |
| `/api/admin/seller-subscriptions` | `items[].shop.shopName`, không có flat `shopName` |
| `/api/admin/seller-banners` | `items[].shop.shopName`, không có flat `shopName` |

### 2.8 Ví / Tài chính

| API | detailType | Ghi chú |
|-----|------------|---------|
| `/api/admin/finance/overview` | `allWallets`, `topup`, `withdrawal`, … | Wallets + WalletTransactions ✅ |
| `/api/admin/finance/overview` | `escrow` | SystemWallet ✅ |
| `/api/admin/finance/overview` | `topup` (default) | FinancePage — label `subscriptionRevenue` map từ `platformRevenue` (#F-02) |

### 2.9 Rút tiền

| API | Ghi chú |
|-----|---------|
| `/api/admin/withdraws` | `search` → query `q` ✅ (`bankApi.js:38-39`) |
| approve/reject | Modal không try/catch (#W-01) |

### 2.10 Thông báo 🔴

| API | Body | Backend chấp nhận |
|-----|------|-------------------|
| `POST /api/admin/notifications/broadcast` | `{ title, content, audience }` | `all \| buyer \| seller` |
| UI default | `audience: 'system'` | ❌ **Rejected** — `"Đối tượng nhận thông báo không hợp lệ."` |

### 2.11 Báo cáo / Audit / Danh mục

| API | Ghi chú |
|-----|---------|
| `/api/admin/reports` | `reporter.fullName`, `createdAt` — UI dùng `reporterName`, `CreatedAt` |
| `/api/admin/audit-logs` | ✅ |
| `/api/admin/categories/shops`, `.../products` | Load all, không pagination |

### 2.12 API restore không có route backend

Các hàm sau gọi endpoint **không tồn tại** trong `backend/routes/adminRoutes.js`:

- `restoreSellerPlan` → `/api/admin/seller-plans/:id/restore`
- `restoreBannerPlan` → `/api/admin/banner-plans/:id/restore`
- `restoreAdminBank` → `/api/admin/banks/:id/restore`
- `restoreCategory` → `.../categories/:id/restore`

Không được gọi từ UI hiện tại → dead API.

---

## 3. Table Test

| Tiêu chí | Kết quả |
|----------|---------|
| Cột / dataIndex | ⚠️ Sai mapping tại Reports, Disputes, Subscriptions, Banners |
| rowKey | ✅ Hầu hết dùng `id \|\| _id`; Notifications fallback composite key |
| Pagination | ✅ `usePaginatedQuery` + Ant Table; Categories/SellerPlans/BannerPlans **không phân trang** |
| Search | ✅ ListToolbar; global header search chỉ navigate `/users?search=` |
| Filter | ✅ Hầu hết list pages; thiếu date range filter |
| Sort | ❌ **Không có** `sorter` trên bất kỳ bảng admin mới nào |

---

## 4. Form / Modal Test

| Màn | Create | Update | Delete | Validate | Ghi chú |
|-----|--------|--------|--------|----------|---------|
| SellerPlans | ✅ | ✅ | ✅ | Ant Form rules | try/catch ✅ |
| BannerPlans | ✅ | ✅ | ✅ | ✅ | |
| Categories | ✅ | ✅ | ✅ | name required | |
| Notifications | — | — | — | title/content required | **Không catch lỗi API** |
| Reviews | — | hide/show | delete | reason **optional UI, required API** | |
| Sellers | — | approve | reject | reason required | ✅ |
| SellerBanners | — | approve | reject/cancel | reject reason không required | no try/catch |
| Withdrawals | — | approve | reject | note optional | no try/catch |
| Reports | — | approve | dismiss | reply optional | no try/catch |

---

## 5. UI Test

| Tiêu chí | Kết quả |
|----------|---------|
| Page title | ✅ `PageContainer` + header `resolvePageTitle` |
| Breadcrumb | ❌ Layout mới **không có** breadcrumb (legacy `AdminLayout.jsx` + `AdminBreadcrumb` không dùng) |
| Buttons / icons | ✅ Ant Design + `@ant-design/icons` |
| Màu / spacing | ✅ `admin-design-system.css` imported trong `main.jsx` |
| Responsive | ⚠️ Table `scroll={{ x }}` một số trang; detail legacy pages CSS riêng |
| Notification badge header | Luôn `count={0}` — không nối API |

---

## 6. Data Mapping Test

| Màn | Model backend | Mapping UI | OK? |
|-----|---------------|------------|-----|
| Người dùng | User | `fullName`, `role`, `status` | ✅ |
| Người bán | SellerVerification, ShopProfile | list ✅; detail scan list | ⚠️ |
| Sản phẩm | Product, ProductVariant | list ✅; detail legacy | ✅ |
| Đơn giữ hàng | Reservation | nested buyer/shop/product | ✅ |
| Khiếu nại | Reservation + dispute fields | `disputeReasonLabel` flat | ❌ UI đọc `row.dispute` |
| Đánh giá | Review | `reviewer`, `productName` | ✅ |
| Gói dịch vụ | SellerPlan | `plans[]` | ✅ |
| Đăng ký gói | SellerSubscription | `shop.shopName` nested | ❌ UI `dataIndex: shopName` |
| Banner | SellerBannerPlan | `shop.shopName` nested | ❌ |
| Ví | Wallet | finance overview table | ✅ |
| Giao dịch | WalletTransaction | `typeLabel`, `amount` | ✅ |
| Rút tiền | WithdrawRequest | `accountName`, `bankName` | ✅ |
| Ví hệ thống | SystemWallet / escrow | `balances`, `details.escrow` | ✅ |
| Thông báo | Notification | history `items` | ✅ list; ❌ broadcast audience |
| Danh mục | ProductCategory, ShopCategory | `categories[]` | ✅ |
| Báo cáo | Report | `reporter`, `createdAt` | ❌ |

---

## 7. Hook Test

| Kiểm tra | Kết quả |
|----------|---------|
| Invalid Hook Call | Mitigated bằng `vite.config.js` + `usePaginatedQuery.jsx`; vẫn rủi ro dev nếu không `--force` |
| useState/useEffect ngoài component | Không phát hiện |
| Duplicate React | Root `19.2.3` vs web `19.2.7` — chỉ ảnh hưởng dev monorepo |
| react/react-dom mismatch trong web | ✅ Cùng `19.2.7` |

---

## 8. Import Test

| Loại | Phát hiện |
|------|-----------|
| Import sai / export sai | Không phát hiện build error |
| Circular dependency | Backend dispute đã tách `disputePartyComplaint.js` ✅ |
| Unused import | Chưa chạy linter toàn repo; build PASS |
| Duplicate layout | `web/src/components/AdminLayout.jsx` (legacy) vs `web/src/admin/layout/AdminLayout.jsx` (active) |

---

## 9. Cleanup — Dead / Unused

### Pages không wired trong `App.jsx` (legacy `web/src/pages/`)

`AccountsPage`, `DashboardPage`, `BanksPage`, `SellerVerificationsPage`, `ShopsPage`, `ProductsPage`, `ReservationsPage`, `WithdrawalsPage`, `FinancePage`, `CategoriesPage`, `BannerPlansPage`, `SellerPlansPage`, `SellerSubscriptionsPage`, `SellerBannersPage`, `BannerPurchasesPage`, `AuditLogPage`, `ReportManagement`, `ReviewManagement`, `SystemNotification`, …

### Utils / API dead

| File / symbol | Lý do |
|---------------|-------|
| `admin/utils/apiNormalize.js` → `normalizeDashboard`, `normalizeListPayload` | Không import |
| `apiNormalize.normalizeDashboard` pending `.slice()` | Bug tiềm ẩn nếu dùng lại |
| `restoreSellerPlan`, `restoreBannerPlan`, `restoreAdminBank`, `restoreCategory` | Backend 404 |
| `web/src/components/AdminLayout.jsx` | Thay bằng admin layout mới |
| `config/adminNavigation.js` + `AdminBreadcrumb` | Chỉ legacy layout |

---

## 10. Danh sách lỗi chi tiết

> Format: **A** Mô tả · **B** File · **C** Dòng · **D** Mức độ · **E** Cách sửa · **F** Tự sửa?

---

### #N-01 — Broadcast thông báo audience `system` không hợp lệ

| | |
|---|---|
| **A** | Form gửi thông báo default `audience: 'system'`. Backend chỉ chấp nhận `all`, `buyer`, `seller`. Mọi lần gửi "Toàn hệ thống" sẽ fail 400. |
| **B** | `web/src/admin/pages/NotificationsPage.jsx` |
| **C** | 65–78 |
| **D** | 🔴 Critical |
| **E** | Đổi option `{ value: 'system' }` → `{ value: 'all', label: 'Toàn hệ thống' }`; `initialValues={{ audience: 'all' }}`. |
| **F** | ✅ **ĐÃ SỬA** 2026-08-02 |

---

### #SD-01 — SellerDetail reject body sai shape

| | |
|---|---|
| **A** | `rejectVerification(token, id, { reason })` — tham số 3 phải là **string** `lyDoTuChoi`. Object → body `{ lyDoTuChoi: { reason: "..." } }` → backend reject fail. |
| **B** | `web/src/admin/pages/SellerDetailPage.jsx`, `web/src/api/sellerApi.js` |
| **C** | SellerDetailPage:64; sellerApi:26–30 |
| **D** | 🟠 High |
| **E** | `await rejectVerification(token, id, reason.trim())` giống `SellersPage.jsx:93`. |
| **F** | ✅ **ĐÃ SỬA** 2026-08-02 |

---

### #SD-02 — Không có API get verification by id

| | |
|---|---|
| **A** | Detail page tải `listAdminVerifications(limit:200)` rồi `.find()` client-side. Hồ sơ ngoài top 200 → "Không tìm thấy". |
| **B** | `web/src/admin/pages/SellerDetailPage.jsx` |
| **C** | 25–32 |
| **D** | 🟠 High |
| **E** | Thêm `GET /api/seller/verification/admin/:id` backend + `getAdminVerification(token, id)` frontend. |
| **F** | ✅ **ĐÃ SỬA** — dùng `search: verificationId` (API search ObjectId có sẵn) |

---

### #R-01 — Ẩn/xóa đánh giá thiếu lý do bắt buộc

| | |
|---|---|
| **A** | UI ghi "Lý do (tuỳ chọn)" nhưng `assertModerationReason` backend bắt buộc khi hide/delete. Submit không reason → 400. |
| **B** | `web/src/admin/pages/ReviewsPage.jsx`, `backend/services/adminReviewService.js` |
| **C** | ReviewsPage:66–73, 271–276; adminReviewService:290–295 |
| **D** | 🟠 High |
| **E** | Required validation + `rules={[{ required: true }]}` trước submit hide/delete. |
| **F** | ✅ Có |

---

### #RP-01 — ReportsPage field mapping sai

| | |
|---|---|
| **A** | Cột "Người gửi" dùng `reporterName` — backend trả `reporter.fullName`. Cột ngày dùng `CreatedAt` — backend trả `createdAt`. |
| **B** | `web/src/admin/pages/ReportsPage.jsx` |
| **C** | 81, 87 |
| **D** | 🟡 Medium |
| **E** | `render: (_, r) => r.reporter?.fullName \|\| r.reporter?.userName`; `dataIndex: 'createdAt'`. |
| **F** | ✅ Có |

---

### #D-01 — DisputesPage cột khiếu nại đọc object nested không tồn tại

| | |
|---|---|
| **A** | UI: `row.dispute \|\| row.latestDispute`. Backend list trả flat `disputeReasonLabel`, `disputeReason`. Cột luôn "—". |
| **B** | `web/src/admin/pages/DisputesPage.jsx` |
| **C** | 68–74 |
| **D** | 🟡 Medium |
| **E** | `row.disputeReasonLabel \|\| row.disputeReason \|\| row.disputeDescription`. |
| **F** | ✅ Có |

---

### #SS-01 — SellerSubscriptionsPage cột Shop trống

| | |
|---|---|
| **A** | `dataIndex: 'shopName'` — DTO chỉ có `shop: { shopName }`. |
| **B** | `web/src/admin/pages/SellerSubscriptionsPage.jsx` |
| **C** | 84 |
| **D** | 🟡 Medium |
| **E** | `render: (_, r) => r.shop?.shopName \|\| r.shopName \|\| '—'`. |
| **F** | ✅ Có |

---

### #SB-01 — SellerBannersPage cột Shop trống

| | |
|---|---|
| **A** | Tương tự #SS-01 — `toSellerBannerDto` không flatten `shopName`. |
| **B** | `web/src/admin/pages/SellerBannersPage.jsx` |
| **C** | 80 |
| **D** | 🟡 Medium |
| **E** | `render: (_, r) => r.shop?.shopName \|\| '—'`. |
| **F** | ✅ Có |

---

### #F-01 — FinancePage nuốt lỗi API

| | |
|---|---|
| **A** | `catch { setData(null) }` — không Alert/message. User thấy stats 0 khi API fail. |
| **B** | `web/src/admin/pages/FinancePage.jsx` |
| **C** | 30–32 |
| **D** | 🟡 Medium |
| **E** | Thêm `error` state + `<Alert type="error" />`. |
| **F** | ✅ Có |

---

### #F-02 — Nhãn doanh thu gói seller có thể sai semantics

| | |
|---|---|
| **A** | `normalizeFinanceOverview` map `subscriptionRevenue` ← `platformRevenue.total`. Có thể không phản ánh chỉ revenue từ SellerSubscription. |
| **B** | `web/src/admin/utils/apiNormalize.js` |
| **C** | 88–99 |
| **D** | 🟡 Medium |
| **E** | Đối chiếu field backend finance service; đổi label hoặc map đúng bucket. |
| **F** | ⚠️ Cần xác nhận business |

---

### #W-01 — Withdrawals / Reports / Notifications modal không try/catch

| | |
|---|---|
| **A** | API fail → unhandled rejection, modal đóng hoặc UI treo không feedback. |
| **B** | `WithdrawalsPage.jsx:51–63`, `ReportsPage.jsx:50–64`, `NotificationsPage.jsx:25–33` |
| **C** | xem trên |
| **D** | 🟡 Medium |
| **E** | Bọc try/catch + `message.error`. |
| **F** | ✅ Có |

---

### #S-01 — Settings /banks redirect mất quản lý ngân hàng

| | |
|---|---|
| **A** | `/banks` → `/settings` nhưng Settings chỉ read-only constants. Backend vẫn có CRUD `/api/admin/banks`. |
| **B** | `web/src/App.jsx:114`, `web/src/admin/pages/SettingsPage.jsx` |
| **C** | — |
| **D** | 🟠 High (functional gap) |
| **E** | Khôi phục Banks UI hoặc thêm section quản lý ngân hàng trong Settings. |
| **F** | ⚠️ Cần thiết kế UI |

---

### #U-01 — Nhiều list page thiếu hiển thị error state

| | |
|---|---|
| **A** | `usePaginatedQuery` set `error` nhưng Notifications, Reports, Withdrawals, SellerSubscriptions, SellerBanners không render Alert. |
| **B** | Các file tương ứng trong `web/src/admin/pages/` |
| **C** | — |
| **D** | 🟡 Medium |
| **E** | Copy pattern `<Alert type="error" message={error} />` từ UsersPage. |
| **F** | ✅ Có |

---

### #UI-01 — Không có breadcrumb trên layout admin mới

| | |
|---|---|
| **A** | Spec UI yêu cầu breadcrumb; layout chỉ hiển thị title phẳng. |
| **B** | `web/src/admin/layout/AdminLayout.jsx` |
| **C** | 139–141 |
| **D** | 🔵 Low |
| **E** | Thêm Ant `Breadcrumb` từ pathname + detail segments. |
| **F** | ✅ Có |

---

### #UI-02 — Không có column sort trên tables

| | |
|---|---|
| **A** | Không table nào dùng Ant `sorter` hoặc gửi `sort` query backend. |
| **B** | Toàn bộ `web/src/admin/pages/*Page.jsx` |
| **C** | — |
| **D** | 🔵 Low |
| **E** | Thêm sorter + wire query params nếu backend hỗ trợ. |
| **F** | ⚠️ Tùy API |

---

### #HC-01 — apiNormalize.normalizeDashboard dead code + bug tiềm ẩn

| | |
|---|---|
| **A** | Hàm gọi `.slice()` trên `pending.sellerVerifications` như array; backend trả **number**. Không được import. |
| **B** | `web/src/admin/utils/apiNormalize.js` |
| **C** | 59–75 |
| **D** | 🔵 Low (dead) / 🟠 High nếu import lại |
| **E** | Xóa hoặc sửa dùng `pendingSummaryRows` pattern như DashboardPage. |
| **F** | ✅ Có |

---

### #HC-02 — Legacy pages/components trùng lặp

| | |
|---|---|
| **A** | ~20 page legacy + `components/AdminLayout.jsx` không dùng — tăng confusion, bundle nếu import nhầm. |
| **B** | `web/src/pages/*`, `web/src/components/AdminLayout.jsx` |
| **C** | — |
| **D** | 🔵 Low |
| **E** | Xóa sau khi migrate detail pages sang Ant Design. |
| **F** | ⚠️ Cần QA regression detail |

---

### #HC-03 — Restore API functions không có backend route

| | |
|---|---|
| **A** | 4 hàm restore trong `sellerPlanApi.js`, `bankApi.js`, `categoryApi.js` — endpoint 404 nếu gọi. |
| **B** | `web/src/api/*.js` |
| **C** | xem grep restore |
| **D** | 🔵 Low |
| **E** | Xóa client hoặc thêm route backend. |
| **F** | ✅ Client-only |

---

### #ENV-01 — React duplicate trong monorepo dev

| | |
|---|---|
| **A** | Expo root `react@19.2.3`, admin web `react@19.2.7`. Vite dev có thể Invalid Hook Call nếu resolve sai. |
| **B** | `package.json` (root), `web/package.json`, `web/vite.config.js` |
| **C** | — |
| **D** | 🟠 High (dev only) |
| **E** | Luôn chạy admin từ `web/` với `npm run dev:clean`; production build ổn định. |
| **F** | ✅ Mitigated |

---

## 11. Ma trận ưu tiên sửa

| Ưu tiên | ID | Effort |
|---------|-----|--------|
| P0 | #N-01 | 5 phút |
| P0 | #SD-01 | 5 phút |
| P1 | #R-01 | 15 phút |
| P1 | #RP-01, #D-01, #SS-01, #SB-01 | 30 phút |
| P1 | #W-01, #U-01, #F-01 | 30 phút |
| P2 | #SD-02, #S-01 | 2–4 giờ |
| P2 | #HC-02 detail migration | 1–2 ngày |
| P3 | #UI-01, #UI-02, #HC-01, #HC-03 | Backlog |

---

## 12. Kết luận QA

Admin Dashboard **build production thành công** và **22/22 route list render được** với cấu trúc Ant Design mới. Không phát hiện lỗi compile, import vòng, hay hook sai vị trí trong code admin active.

**Blockers trước release:**
1. Sửa gửi thông báo (#N-01)
2. Sửa reject seller detail (#SD-01)
3. Bắt buộc lý do khi ẩn/xóa review (#R-01)

**Quality gaps chấp nhận tạm:** detail pages legacy UI, thiếu breadcrumb/sort, quản lý ngân hàng, dead legacy code.

---

*Báo cáo được tạo bởi static audit — khuyến nghị smoke test manual trên staging với tài khoản admin Role=3 sau khi apply P0/P1.*

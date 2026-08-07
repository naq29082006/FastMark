# FastMark — Báo cáo dọn dẹp source code

**Ngày:** 2026-08-05  
**Phạm vi:** Refactor/dọn code — **không** đổi API contract, MongoDB collection name, business logic, luồng Reservation/Wallet/Auth, hay giao diện.

---

## A. File đã xóa

### Backend

| File | Lý do |
|------|--------|
| `backend/utils/geocoding.js` | Không có `require`/`import` nào trong codebase. Geocoding runtime dùng Nominatim qua client hoặc `expo-location`. |
| `backend/scripts/diagIsActiveQuery.js` | Script chẩn đoán một lần, không nằm trong `package.json` scripts. |
| `backend/scripts/diagIsActiveRaw.js` | Tương tự — diag shop `isActive`. |
| `backend/scripts/diagNearbyShops.js` | Tương tự — diag nearby shops. |
| `backend/scripts/diagNearbyShopsFilter.js` | Tương tự — diag filter. |
| `backend/scripts/diagNearbyShopsService.js` | Tương tự — diag service layer. |
| `backend/scripts/extractModelsDoc.js` | Tool sinh tài liệu, không dùng runtime/CI. |
| `backend/scripts/generateModelsCanvas.js` | Tool sinh canvas diagram, không dùng runtime/CI. |

### React Native (`src/`)

| File | Lý do |
|------|--------|
| `src/view/inbox/InboxScreen.js` | Không được mount trong navigation; chỉ `NotificationsScreen` được dùng. |
| `src/view/inbox/ChatScreen.js` | Chỉ được import bởi `InboxScreen` (đã xóa). |
| `src/view/inbox/ChatProfileScreen.js` | Chỉ được import bởi `ChatScreen` (đã xóa). |
| `src/api/messageApi.js` | Chỉ phục vụ cluster chat/inbox không mount. |
| `src/hooks/useChatSocket.js` | Chỉ dùng bởi `ChatScreen`. |
| `src/hooks/useMessageInboxSocket.js` | Chỉ dùng bởi `InboxScreen`. |
| `src/core/utils/chatMessageUtils.js` | Chỉ dùng bởi `ChatScreen`. |
| `src/view/buyer/BuyerShopQrScanScreen.js` | Không có screen nào navigate tới; QR buyer dùng luồng khác. |
| `src/view/shared/components/EscrowHoldStatusBadge.js` | Component không import ở đâu; UI dùng trực tiếp `getEscrowHoldBadgeLabel` / `getEscrowHoldDetailLabel` từ `escrowHold.js`. |

**Giữ lại:** `src/view/inbox/NotificationsScreen.js`, `NotificationDetailScreen.js` — vẫn mount từ `AuthenticatedHome`, `ProfilePanel`, `ShopTabPanel`.

### Admin Web (`web/`)

| File | Lý do |
|------|--------|
| `web/src/components/admin/AdminDetailHero.jsx` | Không import trong bất kỳ page/component nào. |
| `web/src/components/admin/AdminHeroHeader.jsx` | Không import. |
| `web/src/utils/reverseGeocode.js` | Không import; admin không reverse-geocode client-side. |
| `web/src/utils/sortDeletedLast.js` | Không import. |
| `backend/models/ProductImage.js` | Legacy model; runtime không `require`; migration dùng raw collection. |
| `backend/models/ReviewImage.js` | Tương tự. |
| `backend/models/ReportImage.js` | Tương tự. |
| `backend/models/ReservationAuditLog.js` | Tương tự; audit log đã embed vào `ReservationDispute.auditLogs[]`. |

---

## B. Hàm / export đã xóa (không xóa file)

### Backend

| Vị trí | Đã xóa | Lý do |
|--------|--------|--------|
| `backend/constants/index.js` | `SELLER_BUSINESS_DOC_TYPE`, `SELLER_BUSINESS_DOC_TYPE_LABEL` | Không còn tham chiếu sau refactor `SellerVerification.businessImage`. |
| `backend/constants/index.js` | `PAYMENT_STATUS_LABEL` | Không import ở đâu; API derive label qua `depositSettleTo`. |
| `backend/constants/index.js` | `RESERVATION_REPORT_TYPES` | Alias deprecated, zero import. |
| `backend/constants/index.js` | `getShopExpiry()` | Stub luôn trả `null`, zero gọi. |
| `backend/services/categoryService.js` | alias `getCategoryNameMap` | Zero import; dùng `getShopCategoryNameMap` / `getProductCategoryNameMap`. |

### React Native API client

| File | Hàm đã xóa | Lý do |
|------|------------|--------|
| `src/api/buyerOpsApi.js` | `validateBuyerShopQrOnBackend` | Chỉ screen QR đã xóa gọi; backend endpoint vẫn giữ nguyên. |
| `src/api/productApi.js` | `listShopPromotionProductsOnBackend`, `setProductPromotionOnBackend` | Zero import trong app; seller dùng `listMyPromotionProductsOnBackend`, `bulkSetProductPromotionsOnBackend`, `clearProductPromotionOnBackend`. |
| `src/api/notificationApi.js` | `markAllNotificationsReadOnBackend` | Zero import; đọc từng thông báo vẫn qua API hiện có. |
| `src/api/userDiscoveryApi.js` | `getPublicUserFollowingOnBackend` | Zero import trong `src/`; backend route `/api/buyer/users/:userId/following` vẫn hoạt động. |
| `src/api/sellerOpsApi.js` | `getSellerConversationsOnBackend`, `getSellerMessagesOnBackend`, `sendSellerMessageOnBackend`, `deleteSellerMessageOnBackend`, `getSellerConversationPeerOnBackend` | Chỉ cluster chat đã xóa dùng; backend conversation API không đổi. |
| `src/constants/sellerVerification.js` | `SELLER_BUSINESS_DOC_TYPE*`, `SELLER_BUSINESS_DOC_TYPE_OPTIONS`, `SELLER_BUSINESS_DOC_TYPE_LABELS` | UI chỉ upload `businessImage`, không chọn loại giấy tờ. |
| `src/core/config/env.js` | `supabaseConfig`, `getSupabaseConfig()`, `getSupabaseConfigError()`, `readSupabaseEnv()` | Mobile app không dùng Supabase client; upload qua backend API. |

### Admin Web API client

| File | Hàm đã xóa | Lý do |
|------|------------|--------|
| `web/src/api/catalogApi.js` | `deleteShop`, `hideProduct`, `showProduct` | Zero import trong pages. |
| `web/src/api/catalogApi.js` | `listReservations`, `getReservationDetail`, `cancelReservation` | Trùng `reservationAdminApi.js`; pages dùng `reservationAdminApi`. |

---

## C. Model field không sử dụng (chỉ đề xuất — **chưa xóa**)

> Rà soát 24 model trong `backend/models/`. Hầu hết field đang được service/controller/client dùng.  
> **Không thay đổi schema** trong đợt cleanup này.

### Field có usage yếu / write-only — đề xuất xử lý sau migration

| Model | Field | Trạng thái | Ghi chú |
|-------|-------|------------|---------|
| `Report` | `lockSessionAt` | Write-only | Ghi khi tạo lock appeal; `lockAppealService` lọc theo `CreatedAt >= lockedAt` thay vì đọc field này. |
| `Notification` | `UpdatedAt` | Không expose | Set khi mark-read nhưng `toClientNotification()` không trả field. |
| `Wallet` | `CreatedAt`, `UpdatedAt` | Audit-only | Runtime chỉ dùng `userId`, `balance`. |
| `SystemWallet` | `CreatedAt`, `UpdatedAt` | Audit-only | Runtime chỉ dùng `key`, `balance`. |
| `WalletTransaction` | `checkoutUrl` | Write-only | Lưu lúc topup; client dùng PayOS response trực tiếp, không đọc lại từ DB. |
| `ProductCategory` | `categoryName` | Legacy alias | Pre-save sync từ `name`; code ưu tiên `name`. |

### Field legacy trong DB — không có trong schema hiện tại

| Nguồn | Field | Ghi chú |
|-------|-------|---------|
| MongoDB documents cũ | `Product.Thumbnail` | Không trong schema; services vẫn fallback đọc khi `images[]` rỗng. |
| MongoDB documents cũ | `Reservation.paymentStatus` | Đã gỡ khỏi schema; API derive qua `depositSettleTo` trong `toPublicReservation()`. |
| MongoDB documents cũ | `ReservationDispute.buyerTitle`, `sellerTitle` | Đã gỡ; derive từ `disputeReasonTypeLabel()`. |
| MongoDB documents cũ | `Review.isHidden`, `moderationReason`, `deletedAt` | Đã migrate sang `isDeleted`, `removedBy`, `adminRemovalReason`, `removedAt`. |

### Virtual / compat — giữ cho data cũ

| Model | Field virtual | Map tới |
|-------|---------------|---------|
| `Reservation` | `userId` | `buyerId` |
| `Reservation` | `disputed` | `hasDispute` |
| `Reservation` | `hasReviewed` | `hasReview` |
| `Reservation` | `CreatedAt`, `UpdatedAt` | `createdAt`, `updatedAt` |

### Legacy model files (migration-only — đã xóa khỏi disk trong working tree)

| File model (đã xóa) | Collection | Runtime `require()` | Dùng bởi |
|----------------------|------------|----------------------|----------|
| `ProductImage.js` | `productimages` | Không | `migrateEmbeddedImages.js` (raw collection) |
| `ReviewImage.js` | `reviewimages` | Không | `migrateEmbeddedImages.js` |
| `ReportImage.js` | `reportimages` | Không | `migrateEmbeddedImages.js` |
| `ReservationAuditLog.js` | `reservationauditlogs` | Không | `migrateDisputeSchema.js` |

Runtime đọc `Product.images`, `Review.images`, `Report.images`, `ReservationDispute.auditLogs[]` — helper tên `loadProductImages` / `loadReviewImagesMap` vẫn giữ tên cũ nhưng đọc embedded field. **Collection MongoDB không đổi tên** cho đến khi migration chạy xong và admin xác nhận drop.

---

## D. Dependency không sử dụng (đề xuất gỡ)

### Root `package.json` (Expo / React Native app)

| Package | Trạng thái | Ghi chú |
|---------|-----------|---------|
| `@supabase/supabase-js` | **Đề xuất gỡ** | Không `import` trong `src/`; upload qua backend. Đã xóa config Supabase dead trong `env.js`. |
| `react-native-url-polyfill` | **Đề xuất gỡ** | Không import trong `index.js` hay `src/`. |
| `expo-crypto` | **Kiểm tra trước khi gỡ** | Không import trực tiếp; có thể là peer/transitive của `expo-auth-session`. Chạy `npm ls expo-crypto` trước khi gỡ. |

### `backend/package.json`

| Package | Trạng thái | Ghi chú |
|---------|-----------|---------|
| `expo` | **Đề xuất gỡ** | Không `require` trong backend JS; chỉ xuất hiện trong `backend/android/` artifact. |
| `react` | **Đề xuất gỡ** | Không dùng bởi Express server. |
| `react-native` | **Đề xuất gỡ** | Không dùng bởi Express server. |

### Đang dùng — **không gỡ**

| Package | Nơi dùng |
|---------|----------|
| `socket.io-client` | RN hooks (`useOrderSocket`, `useNotificationSocket`, …) + admin realtime |
| `@payos/node` | `backend/services/payosClient.js` |
| `pusher` | `backend/services/pusherService.js` |
| `nodemailer` | `backend/services/mailService.js` |
| `@supabase/supabase-js` | `backend/config/supabase.js`, upload storage |
| `expo-camera` | `SellerBuyerQrScanScreen.js` |
| `react-native-get-random-values` | `index.js` entry |
| `@react-native-community/slider` | `MapScreen.js` |

---

## E. File được gộp

**Không gộp file** trong đợt này.

Lý do: các file nhỏ (<100 dòng) còn lại đa số là boundary rõ (model, API client, constant) hoặc platform-specific (`LeafletMap.native.js` / `.web.js`). Gộp có thể tăng diff noise mà không giảm đáng kể maintenance cost.

---

## F. Rủi ro có thể phát sinh

| Rủi ro | Mức | Mitigation |
|--------|-----|------------|
| **Messaging cluster bị xóa khỏi app** nhưng backend conversation API vẫn tồn tại | Thấp | API không đổi; khi bật lại chat chỉ cần mount lại screen + restore client stubs từ git history. |
| **`validateBuyerShopQrOnBackend` client stub xóa** | Thấp | Endpoint backend vẫn có; flow QR buyer hiện không navigate tới screen đã xóa. |
| **Xóa duplicate admin `catalogApi` reservation helpers** | Thấp | Pages đã dùng `reservationAdminApi.js` exclusively. |
| **Xóa `getCategoryNameMap` alias** | Thấp | Zero import; script/migration cũ nếu có cần đổi sang `getShopCategoryNameMap`. |
| **Constants `SELLER_BUSINESS_DOC_TYPE` backend** | Thấp | Không còn service validate loại giấy tờ; payload cũ vẫn accept qua `businessImage`. |
| **Model field đề xuất (mục C) chưa xóa** | — | An toàn; cần migration + QA trước khi `$unset` production. |
| **Legacy model files đã xóa khỏi disk** | Thấp | Migration scripts vẫn hoạt động qua raw MongoDB driver; không ảnh hưởng runtime Express. |
| **Backend `package.json` có expo/react** | Trung bình (dev env) | Gỡ có thể phá `backend/android` build nếu team dùng; tách rõ mobile vs server trước khi gỡ. |

---

## Kiểm tra sau cleanup

- `node --check` passed: `backend/constants/index.js`, `backend/services/categoryService.js`, `src/api/sellerOpsApi.js`
- **Không đổi:** route mount (`backend/app.js`), MongoDB collection names, API response shape, Reservation/Wallet/Auth flows, UI components đang mount.

## Việc tiếp theo (tùy chọn)

1. Chạy migration scripts còn lại trên staging/production trước khi drop legacy collections.
2. Gỡ dependencies mục D sau `npm ls` / smoke test.
3. Nếu bật lại tính năng chat: restore cluster từ git + mount navigation entry.
4. Xử lý field write-only (mục C) bằng migration có kiểm soát — **không** `$unset` trực tiếp trên production.

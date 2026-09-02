# Kịch bản Demo Bảo vệ Đồ án — FastMark

> **Cách dùng:** Mở app FastMark (Expo) và trang Admin (`npm run admin` trong thư mục `web`) song song với file này.  
> **Gợi ý chuẩn bị:** Chuẩn bị sẵn 1 tài khoản **người mua**, 1 tài khoản **người bán đã được duyệt**, ví buyer đủ số dư cọc, và 1 đơn ở trạng thái phù hợp từng bước (hoặc demo trực tiếp theo thứ tự dưới đây).  
> **Lưu ý:** Hệ thống **không có chức năng chat** giữa buyer và seller — không demo chat.

---

## PHẦN 1 — MỞ ĐẦU (~1 phút)

### Giới thiệu tổng quan

**🎤 Đến phần này nói:**

"Kính chào thầy cô và các bạn trong hội đồng. Em xin phép được demo **FastMark** — một ứng dụng hỗ trợ mua bán tại các gian hàng địa phương theo mô hình **giữ hàng và đặt cọc trước khi đến lấy**.

Trong thực tế, người mua thường gặp khó khăn khi muốn mua hàng gần đó nhưng không chắc shop còn hàng, hoặc lo shop bán hết khi mình tới. Ngược lại, người bán cũng cần cách giữ hàng cho khách một cách có cam kết. FastMark giải quyết bài toán này bằng cách cho phép người mua **đặt cọc qua ví**, shop **xác nhận giữ hàng**, và hai bên **xác nhận giao nhận bằng QR** tại cửa hàng.

Hôm nay em sẽ demo theo một tình huống thực tế: một người mua tìm sản phẩm gần mình, giữ hàng, đến shop nhận hàng; sau đó chuyển sang góc nhìn người bán xử lý đơn. Cuối cùng em sẽ trình bày thêm ví điện tử, cơ chế tranh chấp và trang quản trị Admin.

Hệ thống có ba vai chính: **Người mua** (app di động), **Người bán** (cùng app, tab Gian hàng), và **Admin** (web quản trị)."

**🖱️ Thao tác demo:**

- Mở app FastMark, để màn hình đăng nhập hoặc tab **Trang chủ** (nếu đã đăng nhập buyer).

**🎤 Sau khi thao tác xong nói:**

"Đây là giao diện chính dành cho người mua, gồm các tab: Trang chủ, Sản phẩm, Đơn hàng, Gian hàng, Thông báo và Tài khoản."

**➡️ Câu chuyển tiếp:**

"Em bắt đầu từ góc nhìn người mua — tìm một sản phẩm và thực hiện giữ hàng."

---

## PHẦN 2 — LUỒNG NGHIỆP VỤ CHÍNH (NGƯỜI MUA) (~5–6 phút)

### Bước 1 — Khám phá gian hàng trên bản đồ

**🎤 Đến phần này nói:**

"Người mua có thể bắt đầu từ tab **Trang chủ**, nơi hiển thị bản đồ các gian hàng xung quanh vị trí hiện tại. Điều này giúp người dùng nhanh chóng tìm shop gần mình thay vì phải lướt danh sách dài."

**🖱️ Thao tác demo:**

1. Đăng nhập tài khoản **người mua**.
2. Ở bottom tab, chọn **Trang chủ**.
3. (Nếu được hỏi) Cấp quyền vị trí.
4. Chọn **danh mục shop** trên bản đồ (nếu có).
5. Chạm vào một **marker gian hàng** trên bản đồ, hoặc chọn shop trong danh sách panel phía dưới.

**🎤 Sau khi thao tác xong nói:**

"Trên bản đồ, hệ thống quét và hiển thị các gian hàng đã đăng ký trong bán kính. Người mua thấy được tên shop, khoảng cách, và có thể mở chi tiết gian hàng từ đây."

**➡️ Câu chuyển tiếp:**

"Ngoài bản đồ, người mua cũng có thể tìm sản phẩm trực tiếp — em chuyển sang tab Sản phẩm."

---

### Bước 2 — Tìm sản phẩm và mở gian hàng

**🎤 Đến phần này nói:**

"Tab **Sản phẩm** cho phép khám phá theo danh mục, tìm kiếm theo tên sản phẩm hoặc tên gian hàng, và xem sản phẩm đang giảm giá. Đây là cách phù hợp khi người mua đã biết mình muốn mua gì."

**🖱️ Thao tác demo:**

1. Chọn bottom tab **Sản phẩm**.
2. (Tuỳ chọn) Chọn một **danh mục** hoặc gõ từ khóa vào ô tìm kiếm.
3. Chạm vào một **thẻ sản phẩm** để mở **Chi tiết sản phẩm**.
4. (Tuỳ chọn) Chạm tên/avatar gian hàng để mở **Chi tiết gian hàng**.

**🎤 Sau khi thao tác xong nói:**

"Mỗi sản phẩm hiển thị giá, tồn kho theo biến thể, và gian hàng bán. Từ đây người mua có thể quyết định giữ hàng nếu sản phẩm còn hàng."

**➡️ Câu chuyển tiếp:**

"Em chọn sản phẩm này và thực hiện yêu cầu giữ hàng."

---

### Bước 3 — Yêu cầu giữ hàng và đặt cọc

**🎤 Đến phần này nói:**

"Khi bấm **Giữ hàng**, người mua chọn biến thể, số lượng, **thời gian đến nhận hàng** và có thể thêm ghi chú. Shop có thể cấu hình **tỷ lệ đặt cọc** — ví dụ 30% giá trị đơn. Tiền cọc sẽ được trừ từ **Ví FastMark** của người mua và chuyển vào ví escrow của hệ thống ngay khi gửi yêu cầu."

**🖱️ Thao tác demo:**

1. Trên màn **Chi tiết sản phẩm**, bấm **Giữ hàng**.
2. Trên màn **Yêu cầu giữ hàng**:
   - Chọn **biến thể** (nếu có nhiều).
   - Chỉnh **số lượng**.
   - Chọn **ngày** và **giờ nhận hàng** (phải ở tương lai).
   - (Tuỳ chọn) Nhập ghi chú.
3. Kiểm tra dòng **Đặt cọc X%** và **Số tiền còn lại trả tại shop**.
4. Nếu ví không đủ cọc: bấm liên kết nạp tiền (sẽ demo kỹ ở Phần 4) **hoặc** dùng tài khoản đã nạp sẵn.
5. Bấm **Gửi yêu cầu**.

**🎤 Sau khi thao tác xong nói:**

"Sau khi gửi, đơn chuyển sang trạng thái **Chờ xác nhận**. Tiền cọc đã được giữ — người mua không mất tiền vô căn cứ, mà hệ thống escrow giữ đến khi giao dịch hoàn tất hoặc được xử lý theo quy trình tranh chấp."

**➡️ Câu chuyển tiếp:**

"Em mở tab Đơn hàng để theo dõi trạng thái đơn vừa tạo."

---

### Bước 4 — Theo dõi đơn: Chờ xác nhận

**🎤 Đến phần này nói:**

"Tab **Đơn hàng** của người mua được chia theo vòng đời giao dịch: **Chờ xác nhận**, **Giữ hàng**, **Tranh chấp**, **Hoàn thành** và **Đã hủy**. Đơn mới tạo nằm ở tab Chờ xác nhận cho đến khi shop phản hồi."

**🖱️ Thao tác demo:**

1. Chọn bottom tab **Đơn hàng**.
2. Đảm bảo đang ở sub-tab **Chờ xác nhận**.
3. Chạm vào đơn vừa tạo → mở **Chi tiết đơn hàng**.
4. Chỉ cho hội đồng thấy: mã đơn, sản phẩm, số lượng, tiền cọc, **THỜI GIAN ĐẶT HÀNG**, **THỜI GIAN NHẬN HÀNG**.

**🎤 Sau khi thao tác xong nói:**

"Ở trạng thái này, người mua có thể hủy yêu cầu nếu đổi ý. Shop sẽ nhận thông báo và có thời hạn để xác nhận hoặc từ chối — nếu quá hạn, đơn tự hủy theo quy tắc hệ thống."

**➡️ Câu chuyển tiếp:**

"Giả sử shop đã xác nhận giữ hàng — em chuyển sang tab Giữ hàng. *(Thực tế: chuyển sang tài khoản seller xác nhận ở Phần 3, rồi quay lại buyer.)*"

---

### Bước 5 — Đơn đã xác nhận: tab Giữ hàng

**🎤 Đến phần này nói:**

"Sau khi người bán xác nhận, đơn chuyển sang **Giữ hàng**. Lúc này shop đã cam kết giữ sản phẩm cho khách đến đúng giờ đã chọn. Người mua có thể xem chỉ đường tới shop và chuẩn bị mã QR để nhận hàng."

**🖱️ Thao tác demo:**

1. Trong **Đơn hàng**, chọn sub-tab **Giữ hàng**.
2. Trên dòng đơn, chỉ các nút **Đến lấy hàng** và **Mã QR**.
3. (Tuỳ chọn) Bấm **Đến lấy hàng** → mở màn chỉ đường (**Directions**) với tuyến đường trên bản đồ.
4. Quay lại danh sách đơn.

**🎤 Sau khi thao tác xong nói:**

"Nút **Đến lấy hàng** giúp người mua điều hướng tới shop bằng bản đồ và tuyến xe máy. Phần này hỗ trợ trải nghiệm nhận hàng tại chỗ — không phải giao hàng tận nhà."

**➡️ Câu chuyển tiếp:**

"Đến giờ nhận hàng, người mua mở mã QR để shop quét và xác nhận giao hàng."

---

### Bước 6 — Nhận hàng: hiển thị Mã QR cho shop quét

**🎤 Đến phần này nói:**

"Tại shop, người mua bấm **Mã QR** — màn **Mã nhận hàng** hiển thị QR riêng của đơn cùng tóm tắt số tiền cần trả thêm tại quầy. Người bán dùng chức năng **Quét mã giao hàng** để quét QR trên điện thoại khách, rồi xác nhận đã giao."

**🖱️ Thao tác demo:**

1. Trong tab **Giữ hàng**, bấm **Mã QR** trên đơn (hoặc trong Chi tiết đơn bấm **Mã QR nhận hàng**).
2. Giữ màn **Mã nhận hàng** hiển thị QR và thông tin: sản phẩm, số lượng, cọc đã trả, **tiền còn lại trả tại shop**.
3. *(Không tự quét trên cùng một máy nếu không có tài khoản seller — chuyển sang Phần 3 để seller quét.)*

**🎤 Sau khi thao tác xong nói:**

"QR này gắn với đúng đơn và đúng người mua, tránh nhầm đơn khi shop đông khách. Sau khi shop quét và bấm **Đã giao hàng**, trạng thái đơn cập nhật realtime qua socket — người mua thấy thông báo hoàn tất trên màn này."

**➡️ Câu chuyển tiếp:**

"Sau khi shop xác nhận giao, em kiểm tra lại tab Hoàn thành và tóm tắt quy trình escrow."

---

### Bước 7 — Hoàn thành đơn và đánh giá

**🎤 Đến phần này nói:**

"Sau khi giao hàng, đơn vào giai đoạn **Đã nhận hàng** rồi **Hoàn thành**. Tiền cọc vẫn nằm trong escrow một khoảng thời gian bảo vệ — mặc định theo danh mục sản phẩm, thường khoảng **7 ngày** — để người mua kịp **khiếu nại** nếu hàng có vấn đề. Hết thời hạn không tranh chấp, cọc mới chuyển vào ví người bán."

**🖱️ Thao tác demo:**

1. Tab **Đơn hàng** → sub-tab **Hoàn thành**.
2. Mở **Chi tiết đơn hàng** đã giao.
3. (Nếu có nút) bấm **Đánh giá** → gửi đánh giá ngắn *(không cần demo dài)*.

**🎤 Sau khi thao tác xong nói:**

"Người mua có thể đánh giá sản phẩm và gian hàng sau khi hoàn tất. Điều này giúp xây dựng uy tín cho shop trên nền tảng."

**➡️ Câu chuyển tiếp:**

"Vậy là luồng mua hàng phía người mua đã xong. Em chuyển sang góc nhìn người bán để thấy shop xử lý cùng một đơn như thế nào."

---

## PHẦN 3 — LUỒNG NGƯỜI BÁN (~3 phút)

### Chuyển vai

**🎤 Nói:**

"Để thấy đủ vòng đời giao dịch, em đăng xuất tài khoản người mua và đăng nhập tài khoản **người bán** — shop đã được Admin duyệt. Người bán dùng cùng app FastMark, nhưng quản lý qua bottom tab **Gian hàng**."

**🖱️ Thao tác demo:**

1. Vào **Tài khoản** → đăng xuất (hoặc dùng thiết bị / emulator thứ hai).
2. Đăng nhập tài khoản seller.
3. Chọn bottom tab **Gian hàng** → màn hub quản lý shop.

---

### Bước 8 — Xác nhận đơn Chờ xác nhận

**🎤 Đến phần này nói:**

"Trong hub gian hàng, mục **Đơn bán** tập trung toàn bộ đơn giữ hàng. Tab **Chờ xác nhận** là nơi shop quyết định có nhận giữ hàng cho khách hay không."

**🖱️ Thao tác demo:**

1. Trên hub Gian hàng, bấm **Đơn bán**.
2. Sub-tab **Chờ xác nhận** → chọn đơn của buyer demo.
3. Bấm **Xác nhận giữ hàng** → xác nhận trong hộp thoại.

**🎤 Sau khi thao tác xong nói:**

"Khi xác nhận, hệ thống nhắc shop chuẩn bị giao hàng đúng giờ. Nếu shop từ chối, đơn hủy và tiền cọc hoàn về ví người mua."

**➡️ Câu chuyển tiếp:**

"Đơn đã sang tab Giữ hàng — em demo bước quét QR và xác nhận giao hàng tại shop."

---

### Bước 9 — Quét QR giao hàng và xác nhận

**🎤 Đến phần này nói:**

"Đúng giờ nhận hàng, shop mở **Quét QR giao hàng** — quét mã trên điện thoại khách (màn **Mã nhận hàng**). Hệ thống hiển thị bước **1/2 Quét QR**, sau đó sang màn **Xác nhận giao hàng** để shop kiểm tra lại số lượng, tiền mặt cần thu và bấm **Đã giao hàng**."

**🖱️ Thao tác demo:**

1. Tab **Giữ hàng** (seller) → bấm **Đến nhận hàng** hoặc icon quét ở header, hoặc từ hub bấm **Quét QR giao hàng**.
2. Cấp quyền camera nếu cần.
3. Quét QR trên điện thoại buyer (màn **Mã nhận hàng**).
4. Trên màn **Xác nhận giao hàng**, kiểm tra thông tin → bấm **Đã giao hàng** → xác nhận.

**🎤 Sau khi thao tác xong nói:**

"Sau bước này, escrow bắt đầu tính thời gian bảo vệ. Shop cũng có thể **chỉnh số lượng** hoặc **hủy đơn** tại bước giao nếu phát sinh thực tế — các thao tác đều được ghi nhận trên đơn."

**➡️ Câu chuyển tiếp:**

"Em lướt nhanh thêm hai mảng seller thường dùng: quản lý sản phẩm và cài đặt gian hàng."

---

### Bước 10 — Quản lý sản phẩm & cài đặt shop (ngắn)

**🎤 Đến phần này nói:**

"Người bán quản lý catalog qua **Sản phẩm** và **Đăng bài sản phẩm**, cập nhật tồn kho, giá, khuyến mãi. **Cài đặt shop** cho phép chỉnh tên, avatar/banner, thông tin liên hệ và tỷ lệ cọc — dữ liệu này ảnh hưởng trực tiếp tới form giữ hàng phía người mua."

**🖱️ Thao tác demo:**

1. Quay hub Gian hàng → mở **Sản phẩm** (xem danh sách, không cần tạo mới).
2. Mở **Cài đặt shop** → chỉ banner/avatar và thông tin cơ bản.

**🎤 Sau khi thao tác xong nói:**

"Seller còn có **Thống kê**, **Gói bán**, **Banner** — liên quan gói dịch vụ và quảng bá trên nền tảng; em không demo chi tiết trong phiên này."

**➡️ Câu chuyển tiếp:**

"Tiếp theo em giới thiệu **Ví FastMark** — thành phần then chốt cho cọc và thanh toán nội bộ."

---

## PHẦN 4 — VÍ / NẠP / RÚT TIỀN (~1,5 phút)

### Vai trò ví trong hệ thống

**🎤 Đến phần này nói:**

"**Ví FastMark** là ví nội bộ của từng tài khoản. Người mua dùng ví để **đặt cọc giữ hàng**. Người bán nhận **tiền cọc** sau khi hết thời gian escrow, và có thể **rút về ngân hàng**. Nạp tiền thực hiện qua cổng **PayOS** — sau khi thanh toán thành công, số dư cập nhật tự động."

**🖱️ Thao tác demo:**

1. Tab **Tài khoản** → chạm card **Ví FastMark** (hoặc mục **Quản lý ví**).
2. Trên màn **Quản lý ví**: chỉ **Số dư**, danh sách **Giao dịch gần đây**.
3. Bấm **Nạp tiền** → màn **Nạp tiền** → chọn mệnh giá *(có thể dừng trước bước thanh toán PayOS nếu môi trường demo không có cổng thật)*.
4. Quay lại ví → bấm **Rút tiền** → tab **Rút tiền** / **Lịch sử rút** *(chỉ mô tả form: chọn ngân hàng, số tiền tối thiểu 50.000đ)*.

**🎤 Sau khi thao tác xong nói:**

"Mỗi giao dịch ví — nạp, cọc giữ hàng, hoàn cọc, giải phóng cọc cho seller — đều có lịch sử chi tiết. Lệnh rút tiền vào trạng thái **Chờ duyệt** cho đến khi Admin phê duyệt trên web."

**➡️ Câu chuyển tiếp:**

"Khi giao dịch không diễn ra suôn sẻ, hệ thống có luồng **Tranh chấp** — em demo tình huống ngắn."

---

## PHẦN 5 — TRANH CHẤP (~1,5 phút)

### Tình huống và gửi khiếu nại

**🎤 Đến phần này nói:**

"Tranh chấp xảy ra khi một bên báo cáo sự cố — ví dụ **người bán không có mặt**, **shop đóng cửa**, hoặc sau khi nhận hàng phát hiện **hàng hỏng / thiếu**. Người mua bấm **Khiếu nại**, chọn lý do, mô tả và có thể đính kèm ảnh. Hệ thống giữ cọc cho đến khi Admin xử lý."

**🖱️ Thao tác demo:**

1. Mở một đơn ở trạng thái phù hợp *(quá giờ nhận ở tab Giữ hàng, hoặc đơn Hoàn thành trong thời gian khiếu nại)*.
2. Bấm **Khiếu nại** → form khiếu nại.
3. Chọn lý do *(vd: **Người bán không có mặt** hoặc **Hàng bị hỏng**)* → nhập mô tả ngắn → **Gửi**.
4. Tab **Tranh chấp** → thấy đơn chuyển vào **Đang tranh chấp**.

**🎤 Sau khi thao tác xong nói:**

"Với khiếu nại sau giao hàng, shop có thời hạn phản hồi trước khi Admin can thiệp. Với tranh chấp tại điểm nhận, khi **cả buyer và seller** đều gửi báo cáo, đơn vào hàng chờ xử lý Admin. Cọc không bị chuyển tuỳ tiện cho đến khi có quyết định."

**➡️ Câu chuyển tiếp:**

"Phần xử lý cuối cùng nằm ở trang **Admin** — em chuyển sang web quản trị."

---

## PHẦN 6 — ADMIN (~2 phút)

### Chuyển sang Admin

**🎤 Nói:**

"Admin vận hành FastMark trên **web quản trị**, tách biệt app di động. Tài khoản Admin đăng nhập web — không dùng app buyer/seller. Em trình bày các màn hình cốt lõi: tổng quan, duyệt seller, đơn tranh chấp và tài chính."

**🖱️ Thao tác demo:**

1. Mở trình duyệt → trang Admin FastMark → đăng nhập admin.

---

### Bước 11 — Tổng quan (Dashboard)

**🎤 Đến phần này nói:**

"Màn **Tổng quan** thống kê người dùng, đơn hàng, doanh thu gói dịch vụ, và các việc cần xử lý — như seller chờ duyệt hay rút tiền chờ duyệt."

**🖱️ Thao tác demo:**

1. Menu **Tổng quan** (`/`).
2. Chỉ nhanh biểu đồ đơn theo trạng thái và các thẻ số liệu.

**➡️ Câu chuyển tiếp:** "Tiếp theo em mở phần duyệt người bán."

---

### Bước 12 — Duyệt người bán

**🎤 Đến phần này nói:**

"Trước khi bán hàng, seller **đăng ký người bán** trên app, nộp hồ sơ xác minh. Admin vào **Tài khoản → Người bán** để **Duyệt** hoặc từ chối hồ sơ."

**🖱️ Thao tác demo:**

1. Menu **Tài khoản → Người bán**.
2. Mở một hồ sơ *(ưu tiên hồ sơ **Chờ duyệt** nếu có)* → xem giấy tờ / thông tin shop.

**➡️ Câu chuyển tiếp:** "Khi phát sinh tranh chấp đơn hàng, Admin xử lý tại mục đơn tranh chấp."

---

### Bước 13 — Xử lý tranh chấp đơn hàng

**🎤 Đến phần này nói:**

"Menu **Đơn hàng → Đơn hàng tranh chấp** liệt kê các đơn cần Admin quyết định. Trong chi tiết đơn, Admin chọn **Hoàn cọc cho người mua** hoặc **Giải phóng cọc cho người bán**, kèm nội dung thông báo gửi cả hai bên."

**🖱️ Thao tác demo:**

1. Menu **Đơn hàng → Đơn hàng tranh chấp**.
2. Mở chi tiết một đơn tranh chấp.
3. Chỉ panel **Tranh chấp** và hai nút xử lý *(không bắt buộc bấm thật nếu là dữ liệu production)*.

**➡️ Câu chuyển tiếp:** "Cuối cùng em mở mảng tài chính và rút tiền."

---

### Bước 14 — Tài chính & rút tiền

**🎤 Đến phần này nói:**

"**Tài chính hệ thống** cho thấy **SystemWallet** — ví escrow đang giữ bao nhiêu tiền cọc. **Rút tiền** là hàng chờ duyệt lệnh rút từ seller (và buyer) ra ngân hàng."

**🖱️ Thao tác demo:**

1. Menu **Tài chính hệ thống**.
2. Menu **Rút tiền** → xem danh sách trạng thái **Chờ duyệt / Đã duyệt / Từ chối**.

**🎤 Sau khi thao tác xong nói:**

"Như vậy Admin có đủ công cụ giám sát giao dịch, xử lý sự cố và kiểm soát dòng tiền. Các mục **Khiếu nại** (báo cáo nội dung), **Sản phẩm**, **Danh mục**, **Gói dịch vụ** cũng có trên menu — em không mở hết trong demo này."

**➡️ Câu chuyển tiếp:** "Em xin phép kết luận phần demo."

---

## PHẦN 7 — KẾT THÚC DEMO (~45 giây)

**🎤 Nói:**

"Tóm lại, **FastMark** giải quyết bài toán **mua hàng tại shop địa phương có cam kết**: người mua tìm shop trên **bản đồ** hoặc **danh mục sản phẩm**, **giữ hàng kèm đặt cọc qua ví**, shop **xác nhận và giao hàng bằng QR**, cọc được **escrow** an toàn và chuyển cho seller sau thời gian bảo vệ.

Điểm nổi bật của hệ thống em muốn nhấn mạnh:

- **Quy trình đơn rõ ràng** qua các trạng thái: Chờ xác nhận → Giữ hàng → Hoàn thành, kèm Tranh chấp / Đã hủy khi cần.
- **QR xác nhận giao nhận tại shop**, tránh nhầm đơn.
- **Ví nội bộ + PayOS + escrow** kiểm soát dòng tiền cọc.
- **Cơ chế tranh chấp** và **trang Admin** để vận hành thực tế.

Trong tương lai, em có thể mở rộng thêm đặt hàng giao đi, tích hợp logistics, hoặc tối ưu gợi ý shop theo hành vi người dùng.

Em xin cảm ơn thầy cô và hội đồng đã lắng nghe. Em sẵn sàng trả lời câu hỏi."

---

## Điểm kỹ thuật có thể hội đồng hỏi (không cần nói trong demo)

| Chủ đề | Gợi ý trả lời ngắn |
|--------|-------------------|
| Kiến trúc | App **Expo/React Native** + **Node.js** backend + **Admin React (web)**; realtime đơn hàng qua **Socket.IO**. |
| Database | **MongoDB** (Mongoose models: User, Shop, Product, Reservation, WalletTransaction, SystemWallet…). |
| Authentication | **Firebase Auth** (email/mật khẩu, Google); backend verify ID token. |
| Tiền cọc | Trừ ví buyer → **SystemWallet** (escrow) khi tạo đơn; giải phóng/refund theo lifecycle và quyết định Admin. |
| Thời gian escrow | Field `soNgayKN` trên đơn, resolve theo danh mục sản phẩm (mặc định ~7 ngày). |
| Nạp tiền | **PayOS** — client tạo payment, webhook/poll cập nhật số dư. |
| QR nhận hàng | Buyer hiển thị QR đơn; seller quét qua API `validateSellerPickupQr` rồi `confirmDelivered`. *(Luồng buyer quét QR shop đã deprecated ở backend.)* |

---

## CÁC CÂU HỎI HỘI ĐỒNG CÓ THỂ HỎI

### Nghiệp vụ

**H: Vì sao cần đặt cọc thay vì đặt hàng không cọc?**  
**T:** Cọc tạo cam kết hai chiều: buyer bớt đặt ảo, shop yên tâm giữ hàng. Tiền vào escrow, không vào tay seller ngay.

**H: Nếu shop không xác nhận đơn thì sao?**  
**T:** Đơn ở **Chờ xác nhận**; quá hạn xác nhận thì tự hủy (`confirm_timeout`), cọc hoàn về ví buyer.

**H: Nếu buyer không đến nhận hàng?**  
**T:** Sau giờ nhận, seller có thể báo **Người mua không đến**. Buyer có thể **đồng ý mất cọc** hoặc khiếu nại trong cửa sổ 48 giờ; hết hạn không ai xử lý thì cọc mặc định chuyển seller.

**H: Sau khi giao hàng, buyer khiếu nại được không?**  
**T:** Có — khiếu nại sau giao (hàng hỏng, thiếu, không đúng mô tả) trong thời gian escrow; shop có thời hạn phản hồi trước khi Admin xử lý.

**H: Ai quét QR — buyer hay seller?**  
**T:** Theo code hiện tại: **buyer mở Mã nhận hàng**, **seller quét** bằng **Quét mã giao hàng**, rồi **Xác nhận giao hàng**.

### Kiến trúc & Database

**H: Ba phần hệ thống liên kết thế nào?**  
**T:** Mobile app và Admin web cùng gọi REST API backend; đơn hàng/ví cập nhật realtime qua socket; dữ liệu lưu MongoDB.

**H: Model trung tâm của nghiệp vụ giữ hàng?**  
**T:** **Reservation** — chứa status, depositAmount, pickupTime, escrow fields (`soNgayKN`, `hanGiaiCoc`, `cocChuyenDen`).

### Authentication & Bảo mật

**H: Đăng nhập ra sao?**  
**T:** Firebase Authentication; mỗi request API gửi Bearer token; backend map user MongoDB.

**H: Admin có dùng app mobile không?**  
**T:** Không — đăng nhập Admin trên web sẽ bị chặn trên app (thông báo dùng web).

**H: QR có giả mạo được không?**  
**T:** Payload QR gắn reservationId và buyerId; backend kiểm tra shop sở hữu đơn, trạng thái **Giữ hàng**, và khớp người mua.

### Ví & Tài chính

**H: Tiền cọc nằm ở đâu trước khi về seller?**  
**T:** **SystemWallet** — ví escrow singleton của hệ thống.

**H: Nạp tiền hoạt động thế nào?**  
**T:** Qua **PayOS**; sau trạng thái PAID, backend cộng số dư ví user.

**H: Rút tiền?**  
**T:** User gửi yêu cầu tối thiểu 50.000đ; Admin duyệt trên web mục **Rút tiền**.

### Tranh chấp

**H: Admin xử lý khi nào?**  
**T:** Khi đơn **Tranh chấp** và đủ điều kiện (hai bên báo cáo, hoặc hết hạn phản hồi seller với khiếu nại sau giao); Admin chọn hoàn buyer hoặc giải phóng seller.

**H: Khác gì mục Khiếu nại (Disputes) trên Admin?**  
**T:** **Khiếu nại** (`/disputes`) là báo cáo nội dung (shop, sản phẩm, đánh giá…). **Đơn hàng tranh chấp** (`/reservations?tab=dispute_admin`) là tranh chấp gắn với Reservation và tiền cọc.

---

## TIMELINE

| Thời gian | Phần | Nội dung |
| --------- | ---- | -------- |
| 0:00 – 1:00 | Phần 1 | Giới thiệu FastMark, vai trò, mục tiêu demo |
| 1:00 – 2:00 | Phần 2 · B1 | Bản đồ Trang chủ, tìm gian hàng |
| 2:00 – 3:00 | Phần 2 · B2–B3 | Tab Sản phẩm → Giữ hàng → Gửi yêu cầu + cọc |
| 3:00 – 4:00 | Phần 2 · B4–B5 | Đơn Chờ xác nhận → Giữ hàng, chỉ đường |
| 4:00 – 5:30 | Phần 2 · B6–B7 | Mã QR nhận hàng → Hoàn thành, đánh giá |
| 5:30 – 7:30 | Phần 3 | Seller: xác nhận đơn, quét QR, giao hàng; sản phẩm & cài đặt |
| 7:30 – 9:00 | Phần 4 | Ví FastMark: số dư, nạp PayOS, rút tiền |
| 9:00 – 10:30 | Phần 5 | Khiếu nại / tranh chấp trên app |
| 10:30 – 13:00 | Phần 6 | Admin: Tổng quan, Người bán, Đơn tranh chấp, Tài chính |
| 13:00 – 14:00 | Phần 7 | Kết luận, hướng phát triển, cảm ơn |

**Tổng thời lượng ước tính: 12–14 phút** *(có thể rút ngắn bằng cách bỏ chỉ đường, bỏ đánh giá, hoặc dùng sẵn đơn ở từng trạng thái)*.

---

## Phụ lục — Nhãn UI & trạng thái đơn (tham chiếu nhanh)

**Bottom tab app:** Trang chủ · Sản phẩm · Đơn hàng · Gian hàng · Thông báo · Tài khoản

**Tab đơn hàng (buyer & seller):** Chờ xác nhận · Giữ hàng · Tranh chấp · Hoàn thành · Đã hủy

**Trạng thái Reservation (backend):** `0` Chờ xác nhận → `1` Giữ hàng → `2` Đã nhận hàng → `4` Hoàn thành; `3` Tranh chấp; `5` Đã hủy

**Hub seller (Gian hàng):** Thống kê · Đăng bài sản phẩm · Sản phẩm · Đơn bán · Quét QR giao hàng · Đánh giá · Cài đặt shop · Gói bán · Banner

**Menu Admin chính:** Tổng quan · Sản phẩm · Khiếu nại · Tài chính hệ thống · Ngân hàng · Rút tiền · Tài khoản (Người dùng, Người bán) · Danh mục · Đơn hàng (Tất cả, **Đơn hàng tranh chấp**) · Gói dịch vụ · Gói Banner

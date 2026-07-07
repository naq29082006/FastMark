export const MOCK_STORES = [
  {
    id: '1',
    name: 'Cà phê Vy',
    type: 'cafe',
    latitude: 10.778,
    longitude: 106.702,
    address: '277 Phan Xích Long, Q. Phú Nhuận',
    phone: '0901234567',
    zalo: '0901234567',
    intro:
      'Cà phê Vy là quán cà phê phong cách Sài Gòn xưa, mở cửa từ 6h sáng đến 22h tối. Chúng tôi phục vụ cà phê rang xay, bạc xỉu và các món ăn sáng truyền thống trong không gian ấm cúng.',
    rating_avg: 4.7,
    review_count: 128,
    product_count: 6,
  },
  {
    id: '2',
    name: 'Bánh Mì Huỳnh Hoa',
    type: 'food',
    latitude: 10.7755,
    longitude: 106.699,
    address: '26 Lê Thị Riêng, Q.1',
    phone: '0902345678',
    zalo: '0902345678',
    intro:
      'Bánh mì Huỳnh Hoa nổi tiếng với nhân đầy đặn, pate thơm và bánh giòn. Quán mở cửa từ 14h đến 23h, phục vụ khách địa phương và du khách suốt hơn 30 năm.',
    rating_avg: 4.9,
    review_count: 342,
    product_count: 4,
  },
  {
    id: '3',
    name: 'Phở Lệ',
    type: 'food',
    latitude: 10.7795,
    longitude: 106.6985,
    address: '415 Nguyễn Trãi, Q.5',
    phone: '0903456789',
    zalo: '0903456789',
    intro:
      'Phở Lệ chuyên phở bò Nam Định với nước dùng ninh từ xương bò trong 12 giờ. Không gian rộng rãi, phù hợp gia đình và nhóm bạn.',
    rating_avg: 4.6,
    review_count: 215,
    product_count: 5,
  },
  {
    id: '4',
    name: 'Trà Sữa Gong Cha',
    type: 'milktea',
    latitude: 10.774,
    longitude: 106.7035,
    address: '79 Hồ Tùng Mậu, Q.1',
    phone: '0904567890',
    zalo: '0904567890',
    intro:
      'Gong Cha mang đến trà sữa Đài Loan chính hiệu với topping đa dạng. Quán có không gian ngồi lại thoải mái, phù hợp học nhóm và gặp gỡ bạn bè.',
    rating_avg: 4.5,
    review_count: 189,
    product_count: 8,
  },
  {
    id: '5',
    name: 'Ăn Vặt Hồ Con Rùa',
    type: 'snack',
    latitude: 10.7825,
    longitude: 106.696,
    address: 'Công Trường Quốc Tế, Q.3',
    phone: '0905678901',
    zalo: '0905678901',
    intro:
      'Hồ Con Rùa là điểm hẹn ăn vặt quen thuộc của giới trẻ Sài Gòn. Bán xúc xích nướng, trứng cút lộn, bắp xào và nhiều món ăn đường phố khác.',
    rating_avg: 4.4,
    review_count: 97,
    product_count: 7,
  },
  {
    id: '6',
    name: 'Cà phê Góc Phúc Diễn',
    type: 'cafe',
    latitude: 21.0531,
    longitude: 105.7618,
    address: '45 Phúc Diễn, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0912345678',
    zalo: '0912345678',
    intro:
      'Quán cà phê nhỏ gọn ngay góc Phúc Diễn, mở cửa từ 6h30 sáng. Chuyên cà phê rang xay, trà đá và bánh ngọt handmade, phù hợp học bài và gặp gỡ bạn bè.',
    rating_avg: 4.6,
    review_count: 54,
    product_count: 4,
  },
  {
    id: '7',
    name: 'Bún Đậu Phúc Diễn',
    type: 'food',
    latitude: 21.0525,
    longitude: 105.7628,
    address: '112 Phúc Diễn, P. Phúc Diễn, Q. Bắc Từ Liêm, Hà Nội',
    phone: '0923456789',
    zalo: '0923456789',
    intro:
      'Bún đậu mắm tôm chuẩn vị Hà Nội, đậu chiên giòn, thịt luộc mềm. Quán mở từ 10h đến 21h, giao hàng trong bán kính 2km khu Phúc Diễn.',
    rating_avg: 4.8,
    review_count: 73,
    product_count: 5,
  },
];

export const MOCK_PRODUCTS = [
  { id: 'p1-1', store_id: '1', name: 'Cà phê sữa đá', price: 35000, description: 'Cà phê robusta rang xay, sữa đặc pha chế theo công thức gia truyền.', image_emoji: '☕' },
  { id: 'p1-2', store_id: '1', name: 'Bạc xỉu', price: 38000, description: 'Nhiều sữa, ít cà phê, vị ngọt nhẹ phù hợp mọi lứa tuổi.', image_emoji: '🥛' },
  { id: 'p1-3', store_id: '1', name: 'Cà phê đen đá', price: 30000, description: 'Cà phê đen nguyên chất, đậm vị.', image_emoji: '☕' },
  { id: 'p1-4', store_id: '1', name: 'Bánh mì ốp la', price: 45000, description: 'Bánh mì giòn kèm trứng ốp la, pate và đồ chua.', image_emoji: '🍳' },
  { id: 'p1-5', store_id: '1', name: 'Trà đá', price: 10000, description: 'Trà đá mát lạnh giải khát.', image_emoji: '🧊' },
  { id: 'p1-6', store_id: '1', name: 'Nước cam vắt', price: 40000, description: 'Cam tươi vắt, không đường hóa học.', image_emoji: '🍊' },

  { id: 'p2-1', store_id: '2', name: 'Bánh mì thập cẩm', price: 65000, description: 'Bánh mì đầy đủ nhân: chả, thịt nguội, pate, chả lụa, đồ chua.', image_emoji: '🥖' },
  { id: 'p2-2', store_id: '2', name: 'Bánh mì chả', price: 55000, description: 'Bánh mì chả lụa thơm, pate béo ngậy.', image_emoji: '🥖' },
  { id: 'p2-3', store_id: '2', name: 'Bánh mì thịt nguội', price: 60000, description: 'Thịt nguội nhập khẩu, bánh giòn tan.', image_emoji: '🥖' },
  { id: 'p2-4', store_id: '2', name: 'Bánh mì xíu mại', price: 58000, description: 'Xíu mại nóng hổi chan nước sốt cà.', image_emoji: '🥖' },

  { id: 'p3-1', store_id: '3', name: 'Phở bò tái', price: 75000, description: 'Phở bò tái chín vừa, nước dùng trong ngọt.', image_emoji: '🍜' },
  { id: 'p3-2', store_id: '3', name: 'Phở bò đặc biệt', price: 95000, description: 'Đầy đủ tái, nạm, gầu, bò viên.', image_emoji: '🍜' },
  { id: 'p3-3', store_id: '3', name: 'Phở gà', price: 70000, description: 'Phở gà ta, thịt mềm, nước dùng thanh.', image_emoji: '🍗' },
  { id: 'p3-4', store_id: '3', name: 'Quẩy giòn', price: 15000, description: 'Quẩy chiên giòn ăn kèm phở.', image_emoji: '🥖' },
  { id: 'p3-5', store_id: '3', name: 'Trà đá', price: 8000, description: 'Trà đá miễn phí khi gọi món chính.', image_emoji: '🧊' },

  { id: 'p4-1', store_id: '4', name: 'Trà sữa trân châu đen', price: 55000, description: 'Trà sữa Gong Cha signature, trân châu đen dai.', image_emoji: '🧋' },
  { id: 'p4-2', store_id: '4', name: 'Trà sữa khoai môn', price: 58000, description: 'Vị khoai môn thơm béo, topping pudding.', image_emoji: '🧋' },
  { id: 'p4-3', store_id: '4', name: 'Trà xanh sữa', price: 52000, description: 'Trà xanh matcha Nhật, sữa tươi.', image_emoji: '🍵' },
  { id: 'p4-4', store_id: '4', name: 'Trà đào cam sả', price: 48000, description: 'Trà trái cây tươi mát, không sữa.', image_emoji: '🍑' },
  { id: 'p4-5', store_id: '4', name: 'Trà sữa oreo', price: 60000, description: 'Trà sữa kèm bột oreo và kem cheese.', image_emoji: '🧋' },
  { id: 'p4-6', store_id: '4', name: 'Trà sữa caramel', price: 57000, description: 'Caramel đậm vị, topping trân châu trắng.', image_emoji: '🧋' },
  { id: 'p4-7', store_id: '4', name: 'Sinh tố xoài', price: 45000, description: 'Xoài cát Hòa Lộc xay tươi.', image_emoji: '🥭' },
  { id: 'p4-8', store_id: '4', name: 'Trà sữa matcha', price: 59000, description: 'Matcha Nhật Bản nguyên chất.', image_emoji: '🍵' },

  { id: 'p5-1', store_id: '5', name: 'Xúc xích nướng', price: 25000, description: 'Xúc xích Đức nướng than, chấm tương ớt.', image_emoji: '🌭' },
  { id: 'p5-2', store_id: '5', name: 'Trứng cút lộn', price: 15000, description: 'Trứng cút lộn luộc, chấm muối tiêu chanh.', image_emoji: '🥚' },
  { id: 'p5-3', store_id: '5', name: 'Bắp xào bơ', price: 30000, description: 'Bắp Mỹ xào bơ tỏi, phô mai.', image_emoji: '🌽' },
  { id: 'p5-4', store_id: '5', name: 'Khoai lang nướng', price: 20000, description: 'Khoai lang mật nướng than hồng.', image_emoji: '🍠' },
  { id: 'p5-5', store_id: '5', name: 'Chân gà sả tắc', price: 35000, description: 'Chân gà ngâm chua cay, ăn kèm rau thơm.', image_emoji: '🍗' },
  { id: 'p5-6', store_id: '5', name: 'Nem chua rán', price: 40000, description: 'Nem chua rán giòn, chấm tương ớt.', image_emoji: '🥟' },
  { id: 'p5-7', store_id: '5', name: 'Trà tắc', price: 15000, description: 'Trà tắc mát lạnh, giải nhiệt.', image_emoji: '🍋' },

  { id: 'p6-1', store_id: '6', name: 'Cà phê đen đá', price: 20000, description: 'Cà phê robusta rang tại quán, đậm vị Hà Nội.', image_emoji: '☕' },
  { id: 'p6-2', store_id: '6', name: 'Bạc xỉu', price: 25000, description: 'Nhiều sữa, ít cà phê, ngọt nhẹ.', image_emoji: '🥛' },
  { id: 'p6-3', store_id: '6', name: 'Trà đá vỉa hè', price: 8000, description: 'Trà đá chanh mát lạnh, giá sinh viên.', image_emoji: '🧊' },
  { id: 'p6-4', store_id: '6', name: 'Bánh bông lan trứng muối', price: 22000, description: 'Bánh nướng tươi mỗi sáng, trứng muối béo ngậy.', image_emoji: '🍰' },

  { id: 'p7-1', store_id: '7', name: 'Mẹt bún đậu đầy đủ', price: 65000, description: 'Bún, đậu, thịt, chả cốm, nem rán, mắm tôm pha sẵn.', image_emoji: '🍱' },
  { id: 'p7-2', store_id: '7', name: 'Mẹt bún đậu mini', price: 45000, description: 'Khẩu phần 1 người, đủ nhân cơ bản.', image_emoji: '🍱' },
  { id: 'p7-3', store_id: '7', name: 'Nem rán', price: 30000, description: 'Nem rán giòn, chấm mắm tôm.', image_emoji: '🥟' },
  { id: 'p7-4', store_id: '7', name: 'Chả cốm', price: 35000, description: 'Chả cốm Hà Nội thơm lá dong.', image_emoji: '🌿' },
  { id: 'p7-5', store_id: '7', name: 'Trà đá', price: 5000, description: 'Trà đá miễn phí khi gọi mẹt chính.', image_emoji: '🧊' },
];

export const MOCK_REVIEWS = [
  { id: 'r1-1', store_id: '1', user_name: 'Minh Anh', rating: 5, comment: 'Cà phê ngon, không gian yên tĩnh. Rất thích bạc xỉu ở đây!', created_at: '2026-06-20T10:00:00Z' },
  { id: 'r1-2', store_id: '1', user_name: 'Tuấn Kiệt', rating: 4, comment: 'Quán đẹp, nhân viên thân thiện. Hơi đông vào cuối tuần.', created_at: '2026-06-15T14:30:00Z' },
  { id: 'r1-3', store_id: '1', user_name: 'Lan Hương', rating: 5, comment: 'Cà phê đậm vị, giá hợp lý. Sẽ quay lại!', created_at: '2026-06-10T09:15:00Z' },

  { id: 'r2-1', store_id: '2', user_name: 'Phương Thảo', rating: 5, comment: 'Bánh mì ngon nhất Sài Gòn! Nhân đầy, pate thơm.', created_at: '2026-06-22T18:00:00Z' },
  { id: 'r2-2', store_id: '2', user_name: 'Đức Huy', rating: 5, comment: 'Xếp hàng lâu nhưng đáng giá. Bánh mì thập cẩm là best!', created_at: '2026-06-18T20:30:00Z' },
  { id: 'r2-3', store_id: '2', user_name: 'Ngọc Linh', rating: 4, comment: 'Ngon, giá hơi cao nhưng chất lượng tốt.', created_at: '2026-06-12T15:45:00Z' },
  { id: 'r2-4', store_id: '2', user_name: 'Hoàng Nam', rating: 5, comment: 'Món ăn đường phố đỉnh cao. Khuyên dùng bánh mì xíu mại.', created_at: '2026-06-05T19:00:00Z' },

  { id: 'r3-1', store_id: '3', user_name: 'Thùy Dung', rating: 5, comment: 'Nước dùng ngọt thanh, bò tái mềm. Rất hài lòng!', created_at: '2026-06-21T11:30:00Z' },
  { id: 'r3-2', store_id: '3', user_name: 'Bảo Long', rating: 4, comment: 'Phở ngon, phục vụ nhanh. Chỗ ngồi hơi chật.', created_at: '2026-06-16T12:00:00Z' },
  { id: 'r3-3', store_id: '3', user_name: 'Hà My', rating: 5, comment: 'Gia đình mình ăn phở ở đây mỗi tuần. Luôn ổn định!', created_at: '2026-06-08T07:45:00Z' },

  { id: 'r4-1', store_id: '4', user_name: 'Quỳnh Anh', rating: 4, comment: 'Trà sữa ngon, trân châu dai. Giá hơi cao một chút.', created_at: '2026-06-23T16:00:00Z' },
  { id: 'r4-2', store_id: '4', user_name: 'Văn Tài', rating: 5, comment: 'Trà sữa khoai môn là món yêu thích. Không gian đẹp!', created_at: '2026-06-19T17:30:00Z' },
  { id: 'r4-3', store_id: '4', user_name: 'Kim Chi', rating: 4, comment: 'Đồ uống ổn, nhân viên nhiệt tình.', created_at: '2026-06-11T13:20:00Z' },

  { id: 'r5-1', store_id: '5', user_name: 'Trọng Nghĩa', rating: 4, comment: 'Ăn vặt ngon, giá rẻ. Xúc xích nướng là món phải thử!', created_at: '2026-06-17T21:00:00Z' },
  { id: 'r5-2', store_id: '5', user_name: 'Yến Nhi', rating: 5, comment: 'Không khí vui vẻ, đồ ăn đa dạng. Rất thích hồ con rùa!', created_at: '2026-06-14T20:15:00Z' },
  { id: 'r5-3', store_id: '5', user_name: 'Đình Phúc', rating: 4, comment: 'Bắp xào bơ ngon, trứng cút lộn tươi.', created_at: '2026-06-07T19:30:00Z' },

  { id: 'r6-1', store_id: '6', user_name: 'Hà Linh', rating: 5, comment: 'Quán gần nhà, cà phê ngon giá rẻ. Hay ra đây học bài!', created_at: '2026-07-01T08:30:00Z' },
  { id: 'r6-2', store_id: '6', user_name: 'Minh Quân', rating: 4, comment: 'Bạc xỉu ngon, chỗ ngồi hơi chật giờ cao điểm.', created_at: '2026-06-28T17:00:00Z' },
  { id: 'r6-3', store_id: '6', user_name: 'Thu Hà', rating: 5, comment: 'Bánh bông lan trứng muối siêu ngon, mua về tặng đồng nghiệp.', created_at: '2026-06-25T09:15:00Z' },

  { id: 'r7-1', store_id: '7', user_name: 'Văn Đức', rating: 5, comment: 'Mắm tôm pha chuẩn, đậu chiên giòn. Món bún đậu ngon nhất Phúc Diễn!', created_at: '2026-07-03T12:00:00Z' },
  { id: 'r7-2', store_id: '7', user_name: 'Ngọc Anh', rating: 5, comment: 'Mẹt đầy đủ ăn no, giá hợp lý. Sẽ quay lại!', created_at: '2026-06-30T18:45:00Z' },
  { id: 'r7-3', store_id: '7', user_name: 'Tiến Dũng', rating: 4, comment: 'Ngon, phục vụ nhanh. Hơi đông buổi trưa.', created_at: '2026-06-27T11:30:00Z' },
];

export function getMockStoreById(storeId) {
  return MOCK_STORES.find((s) => String(s.id) === String(storeId)) || null;
}

export function getMockProductsByStoreId(storeId) {
  return MOCK_PRODUCTS.filter((p) => String(p.store_id) === String(storeId));
}

export function getMockReviewsByStoreId(storeId) {
  return MOCK_REVIEWS.filter((r) => String(r.store_id) === String(storeId));
}

export function getMockProductById(productId) {
  return MOCK_PRODUCTS.find((p) => p.id === productId) || null;
}

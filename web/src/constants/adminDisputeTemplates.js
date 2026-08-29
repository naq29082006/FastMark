export const ADMIN_DISPUTE_NOTE_TEMPLATES = {
  refund: [
    'Người bán không giao hàng đúng hẹn. Admin quyết định hoàn cọc cho người mua.',
    'Sản phẩm không đúng mô tả hoặc thiếu hàng. Admin quyết định hoàn cọc cho người mua.',
    'Người mua khiếu nại hợp lệ. Admin quyết định hoàn cọc cho người mua.',
    'Gian hàng không phản hồi đúng hạn. Admin quyết định hoàn cọc cho người mua.',
  ],
  release: [
    'Người mua không đến nhận hàng đúng hẹn. Admin quyết định chuyển cọc cho người bán.',
    'Khiếu nại của người mua không có căn cứ. Admin quyết định chuyển cọc cho người bán.',
    'Người bán cung cấp đủ bằng chứng giao hàng. Admin quyết định chuyển cọc cho người bán.',
    'Người mua không phản hồi trong thời hạn quy định. Admin quyết định chuyển cọc cho người bán.',
  ],
  cancel: [
    'Admin hủy đơn do vi phạm quy định nền tảng. Tiền cọc được hoàn cho người mua.',
    'Admin hủy đơn theo thỏa thuận hai bên. Tiền cọc được hoàn cho người mua.',
    'Admin hủy đơn do thông tin đơn hàng không hợp lệ. Tiền cọc được hoàn cho người mua.',
  ],
};

export function getAdminDisputeNoteTemplates(mode) {
  return ADMIN_DISPUTE_NOTE_TEMPLATES[mode] || [];
}

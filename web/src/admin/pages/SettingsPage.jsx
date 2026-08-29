import { Alert, Descriptions, Tag } from 'antd';

import PageContainer, { PanelCard } from '../components/PageContainer';

/** Khớp backend/constants/index.js — chỉ hiển thị, không chỉnh sửa tại đây. */
const SYSTEM_CONFIG = [
  {
    key: 'depositPercent',
    label: 'Phần trăm đặt cọc (cocTien)',
    value: 'Theo từng shop (0–100%)',
    note: 'Mặc định 0% nếu shop chưa cấu hình',
  },
  {
    key: 'soNgayKN',
    label: 'Số ngày bảo vệ escrow',
    value: '7 ngày',
    note: 'DEFAULT_ESCROW_PROTECTION_DAYS',
  },
  {
    key: 'escrowProtectionRange',
    label: 'Khoảng cấu hình escrow (min–max)',
    value: '1 – 30 ngày',
    note: 'ESCROW_PROTECTION_DAYS_MIN / MAX',
  },
  {
    key: 'sellerResponseDays',
    label: 'Số ngày seller phản hồi khiếu nại',
    value: '2 ngày',
    note: 'DEFAULT_SELLER_RESPONSE_DAYS',
  },
  {
    key: 'disputeWindowHours',
    label: 'Cửa sổ khiếu nại sau pickup',
    value: '48 giờ',
    note: 'RESERVATION_DISPUTE_WINDOW_HOURS',
  },
  {
    key: 'maxReportImages',
    label: 'Ảnh chứng cứ tối đa / báo cáo',
    value: '5 ảnh',
    note: 'MAX_RESERVATION_REPORT_IMAGES',
  },
];

export default function SettingsPage() {
  return (
    <PageContainer
      title="Cấu hình hệ thống"
      subtitle="Tham số vận hành FastMark"
    >
      <Alert
        type="info"
        showIcon
        message="Chỉ xem — cấu hình qua env/backend"
        description="Các giá trị dưới đây được định nghĩa trong backend/constants và biến môi trường. Thay đổi cần deploy lại backend."
        style={{ marginBottom: 16 }}
      />

      <PanelCard title="Tham số giữ hàng & escrow">
        <Descriptions bordered column={1} size="small">
          {SYSTEM_CONFIG.map((item) => (
            <Descriptions.Item key={item.key} label={item.label}>
              <Tag color="blue">{item.value}</Tag>
              {item.note ? (
                <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>{item.note}</span>
              ) : null}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </PanelCard>
    </PageContainer>
  );
}

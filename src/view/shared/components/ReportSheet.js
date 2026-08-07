import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheetDismissOverlay, BottomSheetHandle } from './bottomSheetChrome';
import { FormSheetHeader, FormSheetShell, FORM_SHEET_SCROLL_STYLE } from './formSheetLayout';

const DEFAULT_REPORT_REASONS = [
  'Hàng giả / hàng kém chất lượng',
  'Lừa đảo / gian lận',
  'Ngôn từ xúc phạm',
  'Thông tin sai lệch',
  'Spam / quảng cáo',
  'Khác',
];

export default function ReportSheet({ visible, title, reasons, onClose, onSubmit }) {
  const reasonList = Array.isArray(reasons) && reasons.length > 0 ? reasons : DEFAULT_REPORT_REASONS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BottomSheetDismissOverlay onClose={onClose}>
        <FormSheetShell panelStyle={styles.sheet}>
          <BottomSheetHandle />
          <FormSheetHeader title={title || 'Báo cáo vi phạm'} onClose={onClose} />
          <Text style={styles.subtitle}>Chọn lý do báo cáo</Text>

          <ScrollView
            style={FORM_SHEET_SCROLL_STYLE}
            contentContainerStyle={styles.reasonListContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {reasonList.map((reason) => (
              <Pressable
                key={reason}
                style={({ pressed }) => [styles.reasonItem, pressed && styles.reasonItemPressed]}
                onPress={() => onSubmit?.(reason)}
              >
                <Text style={styles.reasonText}>{reason}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </FormSheetShell>
      </BottomSheetDismissOverlay>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  reasonListContent: {
    paddingBottom: 4,
  },
  reasonItem: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  reasonItemPressed: {
    opacity: 0.85,
  },
  reasonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
});

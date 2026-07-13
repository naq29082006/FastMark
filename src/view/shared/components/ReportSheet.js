import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REPORT_REASONS = [
  'Hàng giả / hàng kém chất lượng',
  'Lừa đảo / gian lận',
  'Ngôn từ xúc phạm',
  'Thông tin sai lệch',
  'Spam / quảng cáo',
  'Khác',
];

export default function ReportSheet({ visible, title, onClose, onSubmit }) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title || 'Báo cáo vi phạm'}</Text>
          <Text style={styles.subtitle}>Chọn lý do báo cáo</Text>

          <ScrollView
            style={styles.reasonList}
            contentContainerStyle={styles.reasonListContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={({ pressed }) => [styles.reasonItem, pressed && styles.reasonItemPressed]}
                onPress={() => onSubmit?.(reason)}
              >
                <Text style={styles.reasonText}>{reason}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Hủy</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '72%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  reasonList: {
    flexGrow: 0,
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
  cancelButton: {
    marginTop: 4,
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  cancelText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
});

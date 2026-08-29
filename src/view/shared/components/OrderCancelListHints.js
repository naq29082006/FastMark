import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';

/** Tab Đã hủy — list chỉ hiện lý do; tiền cọc xem ở chi tiết. */
function OrderCancelListHints({ reasonLine = '' }) {
  const reason = String(reasonLine || '').trim();
  if (!reason) {
    return null;
  }

  return <Text style={styles.reasonText}>Lý do: {reason}</Text>;
}

export default memo(OrderCancelListHints);

const styles = StyleSheet.create({
  reasonText: {
    marginTop: 4,
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
  },
});

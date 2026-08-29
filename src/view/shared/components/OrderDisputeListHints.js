import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { VIEWER_ROLE } from '../../../constants/sellerOrders';
import { getOrderListDisputeDisplay } from '../../../core/utils/orderDisplay';
import { useMinuteNow } from '../../../hooks/useMinuteNow';

function OrderDisputeListHints({ item, viewerRole = VIEWER_ROLE.BUYER }) {
  const currentTime = useMinuteNow();
  const display = getOrderListDisputeDisplay(item, viewerRole, currentTime);
  if (!display) {
    return null;
  }

  const variant = display.variant || 'awaiting_response';
  const eventLineStyle =
    variant === 'resolved' ? styles.resolvedLine : styles.eventLine;
  const secondaryLine = String(display.responseLine || display.pendingLine || '').trim();
  const secondaryStyle =
    variant === 'waiting_admin' ? styles.pendingLine : styles.responseLine;

  return (
    <View style={styles.block}>
      {display.eventLines.map((line, index) => (
        <Text key={`${line}-${index}`} style={eventLineStyle}>
          {line}
        </Text>
      ))}
      {secondaryLine ? <Text style={secondaryStyle}>{secondaryLine}</Text> : null}
    </View>
  );
}

export default memo(OrderDisputeListHints);

const styles = StyleSheet.create({
  block: {
    marginTop: 4,
    gap: 2,
  },
  eventLine: {
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
  },
  resolvedLine: {
    fontSize: 14,
    color: '#076F32',
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
  },
  pendingLine: {
    fontSize: 14,
    color: '#ea580c',
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
  },
  responseLine: {
    fontSize: 14,
    color: '#ea580c',
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
  },
});

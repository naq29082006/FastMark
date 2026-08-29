import { StyleSheet, Text, View } from 'react-native';

import {
  VIEWER_ROLE,
  getDisputeResultReasonText,
  isDisputeResolvedOrder,
} from '../../../constants/sellerOrders';

export default function ReservationDisputeResultBlock({
  reservation,
  reports = [],
  viewerRole = VIEWER_ROLE.BUYER,
}) {
  if (!isDisputeResolvedOrder(reservation)) {
    return null;
  }

  const reasonText = getDisputeResultReasonText(reservation, reports, viewerRole);

  if (!reasonText) {
    return null;
  }

  return (
    <View style={styles.block}>
      <View style={styles.divider} />
      <Text style={styles.heading}>KẾT QUẢ TRANH CHẤP</Text>
      <Text style={styles.bodyText}>{reasonText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  heading: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: '#0f172a',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 22,
  },
});

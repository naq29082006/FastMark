import { StyleSheet, Text, View } from 'react-native';

import {
  isCancelledReservationStatus,
  isCompletedReservationStatus,
  RESERVATION_STATUS,
} from '../../../constants/sellerOrders';
import { formatPrice } from '../../../core/utils/productFormat';

function formatAdjustTime(iso) {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sortAdjustmentsChronological(rows) {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });
}

export function shouldShowQuantityHistory(reservation) {
  const rows = reservation?.adjustments;
  if (!Array.isArray(rows) || !rows.length) {
    return false;
  }
  const status = Number(reservation?.status);
  if (isCompletedReservationStatus(status) || isCancelledReservationStatus(status)) {
    return true;
  }
  return (
    status === RESERVATION_STATUS.RECEIVED ||
    status === RESERVATION_STATUS.DISPUTED
  );
}

function lineTotal(unitPrice, quantity) {
  const unit = Number(unitPrice) || 0;
  const qty = Number(quantity) || 0;
  return Math.round(unit * qty);
}

export default function ReservationAdjustmentSection({ reservation }) {
  const rows = Array.isArray(reservation?.adjustments) ? reservation.adjustments : [];
  if (!shouldShowQuantityHistory(reservation)) {
    return null;
  }

  const chronological = sortAdjustmentsChronological(rows);
  const first = chronological[0];
  const initialQty = Number(first?.oldQuantity) || 0;
  const initialUnit = Number(first?.giaCu) || 0;
  const initialTotal = lineTotal(initialUnit, initialQty);
  const initialDeposit = Number(first?.cocCu) || 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.divider} />
      <Text style={styles.heading}>Lịch sử thay đổi số lượng</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ban đầu</Text>
        <Text style={styles.line}>
          Số lượng: <Text style={styles.value}>{initialQty}</Text>
        </Text>
        <Text style={styles.line}>
          Tổng tiền: <Text style={styles.value}>{formatPrice(initialTotal)}</Text>
        </Text>
        <Text style={styles.line}>
          Tiền cọc: <Text style={styles.value}>{formatPrice(initialDeposit)}</Text>
        </Text>
      </View>

      {chronological.map((item, index) => {
        const depositRefund = Math.max(
          0,
          Math.round(Number(item.cocCu) || 0) - Math.round(Number(item.cocMoi) || 0)
        );
        return (
          <View key={item.id || `${item.createdAt}-${item.newQuantity}-${index}`} style={styles.card}>
            <Text style={styles.cardTitle}>
              {chronological.length > 1 ? `Lần điều chỉnh ${index + 1}` : 'Điều chỉnh'}
            </Text>
            <Text style={styles.line}>
              Số lượng:{' '}
              <Text style={styles.value}>
                {item.oldQuantity} → {item.newQuantity}
              </Text>
            </Text>
            {depositRefund > 0 ? (
              <Text style={styles.refundLine}>
                Hoàn cọc cho người mua:{' '}
                <Text style={styles.refundValue}>{formatPrice(depositRefund)}</Text>
              </Text>
            ) : null}
            <Text style={styles.time}>{formatAdjustTime(item.createdAt)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  heading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  line: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18,
  },
  value: {
    fontWeight: '800',
    color: '#0f172a',
  },
  refundLine: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 18,
  },
  refundValue: {
    fontWeight: '800',
    color: '#ea580c',
  },
  time: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
});

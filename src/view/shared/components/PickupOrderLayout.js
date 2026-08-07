import { Image, StyleSheet, Text, View } from 'react-native';

import AvatarBadge from './AvatarBadge';
import { formatPrice } from '../../../core/utils/productFormat';

export function formatPickupSchedule(iso) {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return {
    time: `${hours}:${minutes}`,
    date: `${day}/${month}/${year}`,
  };
}

export function PickupTimeRow({ pickupTime }) {
  const pickupDisplay = formatPickupSchedule(pickupTime);

  return (
    <View style={styles.pickupTimeRow}>
      {pickupDisplay ? (
        <Text style={styles.pickupTimeText}>
          Thời gian nhận:{' '}
          <Text style={styles.pickupTimeValue}>{pickupDisplay.time}</Text>
          {' · Ngày: '}
          <Text style={styles.pickupTimeValue}>{pickupDisplay.date}</Text>
        </Text>
      ) : (
        <Text style={styles.pickupTimeText}>Thời gian nhận: — · Ngày: —</Text>
      )}
    </View>
  );
}

function InfoRow({ label, value, valueStyle }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]} numberOfLines={4}>
        {value}
      </Text>
    </View>
  );
}

export function PickupOrderSummaryCard({
  productImage,
  productName,
  variantName,
  unitPrice,
  qty = 1,
  totalAmount,
  depositAmount,
  cashDue,
  pickupTime,
  note,
  statusBadge,
  showPickupTime = true,
  buyerName,
}) {
  const noteText = String(note || '').trim();
  const isSellerVerify = Boolean(String(buyerName || '').trim());

  return (
    <View style={styles.summaryCard}>
      <View style={styles.productRow}>
        <View style={styles.productImageWrap}>
          {productImage ? (
            <Image source={{ uri: productImage }} style={styles.productImage} />
          ) : (
            <View style={styles.productPlaceholder}>
              <Text style={styles.productPlaceholderText}>📦</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.summaryProductName} numberOfLines={2}>
            {productName}
          </Text>
          {variantName ? (
            <Text style={styles.summaryVariantName} numberOfLines={1}>
              Loại: {variantName}
            </Text>
          ) : null}
          <View style={styles.priceQtyRow}>
            <Text style={styles.priceText}>{formatPrice(unitPrice)}</Text>
            <Text style={styles.qtyText}>× {qty}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.paymentSection}>
        <View style={styles.paymentRow}>
          <Text style={styles.totalLabel}>TỔNG ĐƠN:</Text>
          <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
        </View>
        <View style={styles.paymentRowHighlight}>
          <Text style={styles.depositLabel}>ĐÃ CỌC:</Text>
          <Text style={styles.depositValue}>{formatPrice(depositAmount)}</Text>
        </View>
        <View style={styles.paymentRowHighlight}>
          <Text style={styles.cashDueLabel}>{isSellerVerify ? 'CẦN THU:' : 'CẦN TRẢ:'}</Text>
          <Text style={styles.cashDueValue}>{formatPrice(cashDue)}</Text>
        </View>
      </View>

      {noteText ? (
        <>
          <View style={styles.divider} />
          <InfoRow label="Ghi chú:" value={noteText} />
        </>
      ) : null}

      {isSellerVerify ? (
        <>
          <View style={styles.divider} />
          <View style={styles.verifyBlock}>
            <Text style={styles.verifyTitle}>Kiểm tra trước khi giao hàng</Text>
            <Text style={styles.verifyHint}>
              Đối chiếu số tiền cần thu với thông tin bên trên trước khi xác nhận.
            </Text>
          </View>
          <View style={styles.divider} />
          <PickupTimeRow pickupTime={pickupTime} />
          <View style={styles.divider} />
          <InfoRow label="Người mua:" value={buyerName} />
        </>
      ) : null}

      {!isSellerVerify && showPickupTime ? (
        <>
          <View style={styles.divider} />
          <PickupTimeRow pickupTime={pickupTime} />
        </>
      ) : null}

      {!isSellerVerify && statusBadge ? (
        <>
          <View style={styles.divider} />
          <View style={styles.metaBlockRow}>
            <Text style={styles.infoLabel}>Trạng thái:</Text>
            <View
              style={[
                styles.statusBadge,
                statusBadge.tone === 'completed' || statusBadge.tone === 'received'
                  ? styles.statusCompleted
                  : statusBadge.tone === 'cancelled'
                    ? styles.statusCancelled
                    : styles.statusWaiting,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  statusBadge.tone === 'completed' || statusBadge.tone === 'received'
                    ? styles.statusCompletedText
                    : statusBadge.tone === 'cancelled'
                      ? styles.statusCancelledText
                      : styles.statusWaitingText,
                ]}
              >
                {statusBadge.label}
              </Text>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

export function PickupOrderHero({
  productImage,
  productName,
  variantName,
  partyName,
  partyAvatar,
  partyLabel = 'Khách hàng',
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroImageWrap}>
        {productImage ? (
          <Image source={{ uri: productImage }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderText}>📦</Text>
          </View>
        )}
      </View>
      <Text style={styles.productName} numberOfLines={2}>
        {productName}
      </Text>
      {variantName ? (
        <Text style={styles.variantName} numberOfLines={1}>
          {variantName}
        </Text>
      ) : null}
      <View style={styles.partyRow}>
        <AvatarBadge name={partyName} uri={partyAvatar || ''} size={24} />
        <View style={styles.partyTextWrap}>
          <Text style={styles.partyLabel}>{partyLabel}</Text>
          <Text style={styles.partyName} numberOfLines={1}>
            {partyName}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function PickupPaymentHighlight({ depositAmount, cashDue, cashDueLabel = 'Tiền cần thu' }) {
  return (
    <View style={styles.paymentCard}>
      <View style={styles.paymentItem}>
        <Text style={styles.paymentLabel}>Cọc đã chuyển</Text>
        <Text style={styles.paymentDeposit}>{formatPrice(depositAmount)}</Text>
      </View>
      <View style={styles.paymentDivider} />
      <View style={styles.paymentItem}>
        <Text style={styles.paymentLabel}>{cashDueLabel}</Text>
        <Text style={styles.paymentCashDue}>{formatPrice(cashDue)}</Text>
      </View>
    </View>
  );
}

export function PickupOrderMeta({ rows = [] }) {
  if (!rows.length) {
    return null;
  }
  return (
    <View style={styles.metaCard}>
      {rows.map((row, index) => (
        <View
          key={row.key || row.label}
          style={[styles.metaRow, index === rows.length - 1 && styles.metaRowLast]}
        >
          <Text style={styles.metaLabel}>{row.label}</Text>
          <Text style={[styles.metaValue, row.valueStyle]} numberOfLines={2}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroImageWrap: {
    marginBottom: 14,
  },
  heroImage: {
    width: 120,
    height: 120,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
  },
  heroPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderText: {
    fontSize: 40,
  },
  productName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 26,
  },
  variantName: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    width: '100%',
  },
  partyTextWrap: {
    flex: 1,
  },
  partyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  partyName: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#076F32',
  },
  paymentCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 14,
  },
  paymentItem: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  paymentDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  paymentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  paymentDeposit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#076F32',
    textAlign: 'center',
  },
  paymentCashDue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#b45309',
    textAlign: 'center',
  },
  metaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  metaRowLast: {
    borderBottomWidth: 0,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  metaValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  productImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productPlaceholderText: {
    fontSize: 28,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  summaryProductName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 22,
  },
  summaryVariantName: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  priceQtyRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#076F32',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  paymentSection: {
    gap: 10,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  paymentRowHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  depositLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#076F32',
    letterSpacing: 0.3,
  },
  depositValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#076F32',
  },
  cashDueLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.3,
  },
  cashDueValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#b45309',
  },
  metaSection: {
    gap: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 20,
  },
  pickupTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupTimeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 20,
  },
  pickupTimeValue: {
    fontWeight: '800',
    color: '#0f172a',
  },
  metaBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  verifyBlock: {
    gap: 6,
  },
  verifyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifyHint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusWaiting: {
    backgroundColor: '#fef3c7',
  },
  statusCompleted: {
    backgroundColor: '#d1fae5',
  },
  statusReceived: {
    backgroundColor: '#d1fae5',
  },
  statusCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusWaitingText: {
    color: '#b45309',
  },
  statusCompletedText: {
    color: '#076F32',
  },
  statusReceivedText: {
    color: '#076F32',
  },
  statusCancelledText: {
    color: '#b91c1c',
  },
});

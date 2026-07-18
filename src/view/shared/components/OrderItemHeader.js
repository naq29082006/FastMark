import { Image, StyleSheet, Text, View } from 'react-native';

import { formatOrderCode } from '../../../core/utils/orderCode';

/**
 * Shared order list card header (buyer + seller):
 * ID · status
 * [image] product name
 *         variant | price | qty
 * party / totals / extra lines below via children or props
 */
export default function OrderItemHeader({
  id,
  statusLabel,
  statusBadgeStyle,
  statusTextStyle,
  thumbnail = '',
  productName = 'Sản phẩm',
  variantName = '',
  quantity = 0,
  unitPriceText = '',
  partyLine = '',
  children = null,
}) {
  const name = productName || 'Sản phẩm';
  const detailLine = [variantName, unitPriceText, quantity ? `SL: ${quantity}` : '']
    .filter(Boolean)
    .join('  |  ');

  return (
    <>
      <View style={styles.idRow}>
        <Text style={styles.orderCode}>{formatOrderCode(id)}</Text>
        {statusLabel ? (
          <View style={[styles.statusBadge, statusBadgeStyle]}>
            <Text style={[styles.statusBadgeText, statusTextStyle]}>{statusLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.productRow}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Text style={styles.thumbFallbackText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {name}
          </Text>
          {detailLine ? (
            <Text style={styles.detailLine} numberOfLines={2}>
              {detailLine}
            </Text>
          ) : null}
        </View>
      </View>

      {partyLine ? (
        <Text style={styles.partyLine} numberOfLines={1}>
          {partyLine}
        </Text>
      ) : null}

      {children}
    </>
  );
}

const styles = StyleSheet.create({
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  orderCode: {
    color: '#076F32',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
  },
  thumbFallbackText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 2,
  },
  productTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  detailLine: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  partyLine: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
});

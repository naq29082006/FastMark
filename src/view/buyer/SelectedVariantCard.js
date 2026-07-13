import { Image, StyleSheet, Text, View } from 'react-native';

import { formatPrice } from '../../core/utils/productFormat';

function getVariantThumb(variant, productThumbnail = '') {
  const firstImage = (variant?.images || []).find((image) => image?.imageUrl);
  return firstImage?.imageUrl || productThumbnail || '';
}

export default function SelectedVariantCard({
  variant,
  productThumbnail = '',
  label = 'Phân loại đã chọn',
}) {
  if (!variant) {
    return null;
  }

  const thumb = getVariantThumb(variant, productThumbnail);
  const remaining = Math.max(0, Number(variant.quantity) || 0);
  const sold = Math.max(0, Number(variant.soldCount) || 0);

  return (
    <View style={styles.box}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={styles.thumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} />
          ) : (
            <Text style={styles.thumbEmoji}>📦</Text>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {variant.variantName || variant.name || 'Loại'}
          </Text>
          <Text style={styles.price}>{formatPrice(variant.price)}</Text>
          <Text style={styles.meta}>
            Còn lại: {remaining > 0 ? remaining : 'Hết'} · Đã bán: {sold}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ecfdf5',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbEmoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 18,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f766e',
    lineHeight: 18,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 16,
  },
});

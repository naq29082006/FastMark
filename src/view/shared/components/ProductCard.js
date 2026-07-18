import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatDistance } from '../../../core/utils/geo';
import { formatPriceRange } from '../../../core/utils/productFormat';
import { getProductImageOverlayLabel } from '../../../core/utils/productAvailability';

function formatProductDistance(product) {
  const meters = Number(product.distanceMeters);
  if (Number.isFinite(meters) && meters >= 0) {
    return formatDistance(meters);
  }
  return '—';
}

export default function ProductCard({
  product,
  isLiked,
  onToggleLike,
  onPress,
  compact = false,
  showDistance = true,
}) {
  const overlayLabel = getProductImageOverlayLabel(product);
  const likeCount = Number(product.likeCount) || 0;

  return (
    <Pressable
      style={({ pressed }) => [
        compact ? styles.nearbyCard : styles.gridCard,
        pressed && styles.productCardPressed,
      ]}
      onPress={() => onPress?.(product.id)}
    >
      <View style={styles.productImageWrap}>
        <View style={[styles.productImage, compact && styles.productImageCompact]}>
          {product.thumbnail ? (
            <Image source={{ uri: product.thumbnail }} style={styles.productThumb} />
          ) : (
            <View style={styles.productEmojiWrap}>
              <Text style={styles.productEmoji}>{product.image_emoji || '📦'}</Text>
            </View>
          )}
          {overlayLabel ? (
            <View style={styles.soldOutMask} pointerEvents="none">
              <Text style={[styles.soldOutText, compact && styles.soldOutTextCompact]}>
                {overlayLabel}
              </Text>
            </View>
          ) : null}
        </View>
        {onToggleLike ? (
          <Pressable
            onPress={() => onToggleLike?.(product.id)}
            hitSlop={8}
            style={[styles.likeBadge, compact && styles.likeBadgeCompact]}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={compact ? 13 : 14}
              color={isLiked ? '#ef4444' : '#64748b'}
            />
            <Text style={[styles.likeCountText, compact && styles.likeCountTextCompact]}>
              {likeCount}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.productInfo, compact && styles.productInfoCompact]}>
        <Text style={[styles.productName, compact && styles.productNameCompact]} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={[styles.productPrice, compact && styles.productPriceCompact]} numberOfLines={1}>
          {formatPriceRange(product.minPrice ?? product.price, product.maxPrice ?? product.price)}
        </Text>
        <View style={styles.productFooter}>
          <Text style={[styles.productSold, compact && styles.productSoldCompact]} numberOfLines={1}>
            Đã bán: {Number(product.soldCount) || 0}
          </Text>
          {showDistance ? (
            <Text style={[styles.productMeta, compact && styles.productMetaCompact]} numberOfLines={1}>
              {formatProductDistance(product)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nearbyCard: {
    width: 148,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productCardPressed: {
    opacity: 0.92,
  },
  productImageWrap: {
    position: 'relative',
    width: '100%',
  },
  productImage: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  productImageCompact: {
    aspectRatio: 1,
  },
  productThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productEmojiWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEmoji: {
    fontSize: 40,
  },
  soldOutMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  soldOutTextCompact: {
    fontSize: 12,
  },
  likeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 6,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 2,
  },
  likeBadgeCompact: {
    top: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  likeCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  likeCountTextCompact: {
    fontSize: 11,
  },
  productInfo: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  productInfoCompact: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 3,
  },
  productNameCompact: {
    fontSize: 12,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#076F32',
    marginBottom: 4,
  },
  productPriceCompact: {
    fontSize: 11,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  productSold: {
    flexShrink: 1,
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  productSoldCompact: {
    fontSize: 10,
  },
  productMeta: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  productMetaCompact: {
    fontSize: 10,
  },
});

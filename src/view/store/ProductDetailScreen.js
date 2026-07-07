import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { loadProductById, loadStoreById } from '../../viewmodel/store/storeViewModel';
import ContactActions from './components/ContactActions';
import StarRating from './components/StarRating';
import { storeLogger as log } from '../../core/utils/logger';

function formatPrice(price) {
  return `${Number(price).toLocaleString('vi-VN')}đ`;
}

export default function ProductDetailScreen({ productId, onBack, onStorePress }) {
  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    log.info('ProductDetailScreen:load', { productId });

    loadProductById(productId)
      .then(async (productData) => {
        if (!isCurrent) return;
        setProduct(productData);
        if (productData?.store_id) {
          const storeData = await loadStoreById(productData.store_id);
          if (isCurrent) setStore(storeData);
        }
        log.ok('ProductDetailScreen:loaded', {
          productId,
          found: Boolean(productData),
          storeId: productData?.store_id || null,
        });
        setLoading(false);
      })
      .catch((error) => {
        log.fail('ProductDetailScreen:load-failed', error);
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.errorText}>Không tìm thấy sản phẩm</Text>
        <Pressable onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageSection}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <View style={styles.imageBox}>
            <Text style={styles.productEmoji}>{product.image_emoji}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>

          {store && (
            <View style={styles.storeCard}>
              <View style={styles.storeCardLeft}>
                <View style={styles.storeAvatar}>
                  <Text style={styles.storeAvatarText}>{store.name.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.storeCardLabel}>Gian hàng</Text>
                  <Text style={styles.storeCardName}>{store.name}</Text>
                  <View style={styles.storeRating}>
                    <StarRating rating={store.rating_avg} size={12} showValue />
                  </View>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.viewStoreBtn, pressed && styles.pressed]}
                onPress={() => onStorePress?.(store.id)}
              >
                <Text style={styles.viewStoreBtnText}>Xem shop</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>
          <Text style={styles.description}>
            {product.description || 'Chưa có mô tả cho sản phẩm này.'}
          </Text>
        </View>
      </ScrollView>

      {store && (
        <View style={styles.bottomBar}>
          <ContactActions phone={store.phone} zalo={store.zalo} compact />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 12,
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    color: '#0f766e',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageSection: {
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtnText: {
    fontSize: 20,
    color: '#0f172a',
    fontWeight: '700',
  },
  imageBox: {
    height: 280,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEmoji: {
    fontSize: 80,
  },
  infoSection: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
  },
  productName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f766e',
    marginBottom: 20,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  storeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  storeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeAvatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
  },
  storeCardLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  storeCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  storeRating: {
    marginTop: 2,
  },
  viewStoreBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewStoreBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
});

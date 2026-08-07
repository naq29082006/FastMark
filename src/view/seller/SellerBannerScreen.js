import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { getMyProductsOnBackend } from '../../api/productApi';
import {
  loadSellerBannerViewModel,
  purchaseSellerBannerViewModel,
  requestSellerBannerHangViewModel,
} from '../../viewmodel/seller/sellerBannerViewModel';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { formatPrice } from '../../core/utils/productFormat';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { isSameData } from '../../core/utils/realtimeList';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useResourceSocket } from '../../hooks/useResourceSocket';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import WalletBalanceTopUpBar from '../shared/components/WalletBalanceTopUpBar';
import PlanTabPanel from '../shared/components/PlanTabPanel';
import { BOTTOM_SHEET_BORDER, BottomSheetDismissOverlay, BottomSheetHandle, BottomSheetPanel } from '../shared/components/bottomSheetChrome';

const BANNER_SCREEN_TABS = [
  { key: 'owned', label: 'Gói đang có' },
  { key: 'buy', label: 'Mua gói' },
];

const BANNER_TARGET_TYPE = {
  PRODUCT: 1,
  SHOP: 2,
};

function resolveProductThumbnail(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.thumbnail === 'string' && item.thumbnail) return item.thumbnail;
  if (Array.isArray(item.thumbnails) && item.thumbnails[0]) {
    const first = item.thumbnails[0];
    return typeof first === 'string' ? first : first?.imageUrl || first?.url || '';
  }
  if (Array.isArray(item.images) && item.images[0]) {
    const first = item.images[0];
    return typeof first === 'string' ? first : first?.imageUrl || first?.url || '';
  }
  return '';
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return '';
  }
}

function formatExpiry(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('vi-VN');
  } catch {
    return '';
  }
}

export default function SellerBannerScreen({ onBack, onOpenWallet, onOpenSubscription }) {
  const insets = useScreenInsets();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [buyingPlan, setBuyingPlan] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBannerId, setSelectedBannerId] = useState(null);
  const [imageUri, setImageUri] = useState('');
  const [targetType, setTargetType] = useState(BANNER_TARGET_TYPE.SHOP);
  const [targetProductId, setTargetProductId] = useState('');
  const [products, setProducts] = useState([]);
  const [productsPage, setProductsPage] = useState(1);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [productsTotal, setProductsTotal] = useState(0);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [screenTab, setScreenTab] = useState('owned');

  const banners = useMemo(
    () => (Array.isArray(data?.banners) ? data.banners : data?.banner ? [data.banner] : []),
    [data]
  );
  const selectedBanner = useMemo(
    () => banners.find((item) => String(item.id) === String(selectedBannerId)) || null,
    [banners, selectedBannerId]
  );
  const canEdit = Boolean(selectedBanner?.canEditCreative);
  const selectedProduct = useMemo(
    () => products.find((item) => String(item.id) === String(targetProductId)) || null,
    [products, targetProductId]
  );

  const fillFormFromBanner = useCallback((banner) => {
    setImageUri(banner?.image || '');
    setTargetType(Number(banner?.targetType) || BANNER_TARGET_TYPE.SHOP);
    setTargetProductId(
      Number(banner?.targetType) === BANNER_TARGET_TYPE.PRODUCT ? String(banner?.targetId || '') : ''
    );
  }, []);

  const load = useCallback(
    async ({ selectBannerId = null, closeDetail = true, silent = false } = {}) => {
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const result = await loadSellerBannerViewModel();
        setData((current) => (isSameData(current, result) ? current : result));
        if (selectBannerId) {
          const banner = (result?.banners || []).find(
            (item) => String(item.id) === String(selectBannerId)
          );
          if (banner) {
            setSelectedBannerId(banner.id);
            fillFormFromBanner(banner);
          } else if (closeDetail) {
            setSelectedBannerId(null);
          }
        } else if (closeDetail) {
          setSelectedBannerId(null);
        }
        return result;
      } catch (error) {
        if (error.statusCode === 403) {
          Alert.alert('Cần gói bán hàng', error.message || 'Hãy mua gói bán hàng trước.', [
            { text: 'Đóng', style: 'cancel' },
            { text: 'Mua gói', onPress: () => onOpenSubscription?.() },
          ]);
        } else {
          Alert.alert('Lỗi', error.message || 'Không tải được gói banner.');
        }
        return null;
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [fillFormFromBanner, onOpenSubscription]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleBannerRealtime = useCallback(
    (payload) => {
      const type = String(payload?.type || '').trim();
      if (type !== 'banner' && type !== 'wallet') {
        return;
      }
      // Cập nhật im lặng: không bật spinner toàn màn, không đóng form đang mở.
      load({ closeDetail: false, silent: true });
    },
    [load]
  );

  useResourceSocket({
    enabled: true,
    onResourceUpdated: handleBannerRealtime,
  });

  const loadProducts = useCallback(async ({ nextPage = 1 } = {}) => {
    if (nextPage > 1) {
      setLoadingMoreProducts(true);
    }
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) return;
      const rowsPage = await getMyProductsOnBackend(idToken, {
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const rows = rowsPage.items || [];
      const mapped = (Array.isArray(rows) ? rows : [])
        .filter((item) => Number(item.status) === 1)
        .map((item) => ({
          id: String(item.id || item._id || ''),
          name: item.productName || item.name || 'Sản phẩm',
          thumbnail: resolveProductThumbnail(item),
        }))
        .filter((item) => item.id);
      setProducts((current) =>
        nextPage === 1 ? mapped : appendUniqueById(current, mapped)
      );
      setProductsPage(Number(rowsPage.page) || nextPage);
      setProductsHasMore(Boolean(rowsPage.hasMore));
      setProductsTotal(Math.max(0, Number(rowsPage.total) || 0));
    } catch {
      if (nextPage === 1) {
        setProducts([]);
        setProductsHasMore(false);
        setProductsTotal(0);
      }
    } finally {
      setLoadingMoreProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts({ nextPage: 1 });
  }, [loadProducts]);

  function handleSelectBanner(banner) {
    setSelectedBannerId(banner.id);
    fillFormFromBanner(banner);
  }

  async function handlePurchase(plan) {
    const days = Number(plan.durationDays) || 7;
    Alert.alert(
      'Mua gói banner',
      `Trừ ${formatPrice(plan.price)} để mua ${plan.name} (${days} ngày)?\n\nSau khi mua chỉ lưu ngày mua. Bạn sẽ chọn ảnh + đích đến rồi gửi admin duyệt mới có hiệu lực.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Mua ngay',
          onPress: async () => {
            setBuyingPlan(plan.id);
            try {
              const purchased = await purchaseSellerBannerViewModel(plan.id);
              const newId = purchased?.banner?.id;
              setScreenTab('owned');
              await load({ selectBannerId: newId, closeDetail: !newId });
            } catch (error) {
              const message = error.message || 'Không mua được banner.';
              if (String(message).includes('Số dư')) {
                Alert.alert('Số dư không đủ', message, [
                  { text: 'Đóng', style: 'cancel' },
                  { text: 'Nạp ví', onPress: () => onOpenWallet?.() },
                ]);
              } else {
                Alert.alert('Lỗi', message);
              }
            } finally {
              setBuyingPlan(null);
            }
          },
        },
      ]
    );
  }

  async function handlePickImage() {
    if (!canEdit) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thông báo', 'Cần quyền thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.base64) {
      const mimeType = asset.mimeType || 'image/jpeg';
      setImageUri(`data:${mimeType};base64,${asset.base64}`);
      return;
    }
    if (asset.uri) setImageUri(asset.uri);
  }

  async function handleRequestHang() {
    if (!selectedBanner?.id) {
      Alert.alert('Thông báo', 'Hãy chọn gói banner đã mua.');
      return;
    }
    if (!imageUri) {
      Alert.alert('Thông báo', 'Vui lòng chọn ảnh banner.');
      return;
    }
    if (targetType === BANNER_TARGET_TYPE.PRODUCT && !targetProductId) {
      Alert.alert('Thông báo', 'Vui lòng chọn sản phẩm đích.');
      return;
    }

    setIsSaving(true);
    try {
      const banner = await requestSellerBannerHangViewModel({
        bannerId: selectedBanner.id,
        image: imageUri,
        targetType,
        targetId:
          targetType === BANNER_TARGET_TYPE.PRODUCT
            ? targetProductId
            : selectedBanner.shopId,
      });
      setData((current) => {
        const nextBanners = (current?.banners || []).map((item) =>
          String(item.id) === String(banner.id) ? banner : item
        );
        return { ...current, banners: nextBanners, banner };
      });
      fillFormFromBanner(banner);
      Alert.alert(
        'Đã gửi',
        selectedBanner.lifecycle === 'rejected'
          ? 'Đã gửi lại yêu cầu treo. Chờ admin duyệt mới có hiệu lực.'
          : 'Yêu cầu treo banner đã gửi. Không thể sửa khi đang chờ duyệt.'
      );
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không gửi được yêu cầu treo.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCloseDetail() {
    setSelectedBannerId(null);
  }

  const plans = Array.isArray(data?.plans) ? data.plans : [];

  if (selectedBanner) {
    return (
      <ProfileSubScreen
        title={canEdit ? 'Yêu cầu treo banner' : 'Chi tiết yêu cầu'}
        onBack={handleCloseDetail}
      >
        <View style={styles.activeCard}>
          <Text style={styles.activeMeta}>
            {selectedBanner.planName} · {selectedBanner.lifecycleLabel}
          </Text>
          <Text style={styles.bannerCardMeta}>
            Ngày mua {formatDateTime(selectedBanner.ngayMua)}
          </Text>
          {selectedBanner.lifecycle === 'active' ? (
            <>
              <Text style={styles.bannerCardMeta}>
                Hiệu lực {formatExpiry(selectedBanner.startDate)} →{' '}
                {formatExpiry(selectedBanner.endDate)}
              </Text>
              <Text style={styles.bannerCardMeta}>
                Số click (Quan tâm): {Number(selectedBanner.clickCount) || 0}
              </Text>
            </>
          ) : (
            <Text style={styles.formHint}>
              Ngày hiệu lực / hết hạn chỉ có sau khi admin duyệt yêu cầu treo.
            </Text>
          )}

          <Text style={styles.label}>Đích đến</Text>
          <View style={styles.targetRow}>
            <Pressable
              style={[
                styles.targetChip,
                targetType === BANNER_TARGET_TYPE.SHOP && styles.targetChipActive,
                !canEdit && styles.disabled,
              ]}
              disabled={!canEdit}
              onPress={() => {
                setTargetType(BANNER_TARGET_TYPE.SHOP);
                setTargetProductId('');
              }}
            >
              <Text
                style={[
                  styles.targetChipText,
                  targetType === BANNER_TARGET_TYPE.SHOP && styles.targetChipTextActive,
                ]}
              >
                Gian hàng
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.targetChip,
                targetType === BANNER_TARGET_TYPE.PRODUCT && styles.targetChipActive,
                !canEdit && styles.disabled,
              ]}
              disabled={!canEdit}
              onPress={() => setTargetType(BANNER_TARGET_TYPE.PRODUCT)}
            >
              <Text
                style={[
                  styles.targetChipText,
                  targetType === BANNER_TARGET_TYPE.PRODUCT && styles.targetChipTextActive,
                ]}
              >
                Sản phẩm
              </Text>
            </Pressable>
          </View>

          {targetType === BANNER_TARGET_TYPE.PRODUCT ? (
            <>
              <Text style={styles.formHint}>Chọn 1 sản phẩm đang bán của gian hàng bạn.</Text>
              <Pressable
                style={[styles.productPicker, !canEdit && styles.disabled]}
                disabled={!canEdit}
                onPress={() => setShowProductPicker(true)}
              >
                {selectedProduct ? (
                  <View style={styles.productPickerRow}>
                    {selectedProduct.thumbnail ? (
                      <Image
                        source={{ uri: selectedProduct.thumbnail }}
                        style={styles.productPickerThumb}
                      />
                    ) : (
                      <View style={[styles.productPickerThumb, styles.productThumbPlaceholder]}>
                        <Text style={styles.productThumbPlaceholderText}>SP</Text>
                      </View>
                    )}
                    <Text style={styles.productPickerText} numberOfLines={2}>
                      {selectedProduct.name}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.productPickerPlaceholder}>Chọn sản phẩm</Text>
                )}
              </Pressable>
            </>
          ) : null}

          <Text style={styles.label}>Ảnh banner</Text>
          <Pressable
            style={[styles.imagePicker, !canEdit && styles.disabled]}
            disabled={!canEdit}
            onPress={handlePickImage}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} />
            ) : (
              <Text style={styles.imagePickerText}>Chọn ảnh banner</Text>
            )}
          </Pressable>

          {canEdit ? (
            <Pressable
              style={[styles.primaryBtn, isSaving && styles.disabled]}
              disabled={isSaving}
              onPress={handleRequestHang}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {selectedBanner.lifecycle === 'rejected'
                    ? 'Gửi lại yêu cầu treo'
                    : 'Gửi yêu cầu treo'}
                </Text>
              )}
            </Pressable>
          ) : (
            <Text style={styles.lockHint}>
              {selectedBanner.lifecycle === 'pending'
                ? 'Đã gửi yêu cầu — đang khóa chỉnh sửa. Chờ admin duyệt mới có hiệu lực.'
                : selectedBanner.lifecycle === 'active'
                  ? 'Admin đã duyệt — không thể chỉnh sửa banner. Đang trong thời gian hiệu lực.'
                  : selectedBanner.lifecycle === 'expired'
                    ? 'Banner đã hết hạn — không chỉnh sửa được. Hãy mua gói mới nếu cần treo tiếp.'
                    : 'Gói này không còn chỉnh sửa được.'}
            </Text>
          )}
          {selectedBanner.lifecycle === 'rejected' && selectedBanner.violationReason ? (
            <Text style={styles.rejectReason}>
              Admin từ chối: {selectedBanner.violationReason}. Hãy sửa rồi gửi lại.
            </Text>
          ) : null}
        </View>

        <Modal visible={showProductPicker} transparent animationType="slide" onRequestClose={() => setShowProductPicker(false)}>
          <BottomSheetDismissOverlay onClose={() => setShowProductPicker(false)}>
            <BottomSheetPanel
              style={[
                styles.modalCard,
                { paddingBottom: Math.max(insets.bottom, 12) + 8 },
              ]}
            >
              <BottomSheetHandle />
              <Text style={styles.modalTitle}>Chọn sản phẩm của gian hàng</Text>
              <ScrollView
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                showsVerticalScrollIndicator={false}
              >
                {products.length === 0 ? (
                  <Text style={styles.empty}>Chưa có sản phẩm đang bán.</Text>
                ) : (
                  <>
                  {products.map((product) => {
                    const selected = String(product.id) === String(targetProductId);
                    return (
                      <Pressable
                        key={product.id}
                        style={[styles.modalItem, selected && styles.modalItemSelected]}
                        onPress={() => {
                          setTargetProductId(String(product.id));
                          setShowProductPicker(false);
                        }}
                      >
                        {product.thumbnail ? (
                          <Image
                            source={{ uri: product.thumbnail }}
                            style={styles.modalItemThumb}
                          />
                        ) : (
                          <View style={[styles.modalItemThumb, styles.productThumbPlaceholder]}>
                            <Text style={styles.productThumbPlaceholderText}>SP</Text>
                          </View>
                        )}
                        <Text style={styles.modalItemText} numberOfLines={2}>
                          {product.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <LoadMoreButton
                    currentCount={products.length}
                    totalCount={
                      productsHasMore
                        ? Math.max(productsTotal, products.length + DEFAULT_PAGE_SIZE)
                        : products.length
                    }
                    loading={loadingMoreProducts}
                    onPress={() => loadProducts({ nextPage: productsPage + 1 })}
                  />
                  </>
                )}
              </ScrollView>
              <Pressable
                style={styles.modalClose}
                onPress={() => setShowProductPicker(false)}
              >
                <Text style={styles.modalCloseText}>Đóng</Text>
              </Pressable>
            </BottomSheetPanel>
          </BottomSheetDismissOverlay>
        </Modal>
      </ProfileSubScreen>
    );
  }

  return (
    <ProfileSubScreen title="Banner quảng cáo" onBack={onBack}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : (
        <>
          <PlanTabPanel
            tabs={BANNER_SCREEN_TABS}
            activeTab={screenTab}
            onChangeTab={setScreenTab}
          >
          {screenTab === 'owned' ? (
            <>
              <Text style={styles.sectionHintTop}>
                Bấm vào gói để xem chi tiết hoặc gửi yêu cầu treo banner.
              </Text>
              {banners.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="images-outline" size={28} color="#94a3b8" />
                  <Text style={styles.emptyCardTitle}>Chưa có gói banner</Text>
                  <Text style={styles.emptyCardBody}>
                    Gói đã mua sẽ hiển thị tại đây. Chuyển sang tab Mua gói để đăng ký.
                  </Text>
                </View>
              ) : (
                banners.map((banner) => (
                  <Pressable
                    key={banner.id}
                    style={styles.bannerCard}
                    onPress={() => handleSelectBanner(banner)}
                  >
                    <Text style={styles.bannerCardTitle}>{banner.planName || 'Gói banner'}</Text>
                    <Text style={styles.bannerCardMeta}>
                      Ngày mua {formatDateTime(banner.ngayMua)}
                    </Text>
                    <Text
                      style={[
                        styles.bannerCardStatus,
                        banner.lifecycle === 'active' && styles.statusActive,
                        banner.lifecycle === 'pending' && styles.statusPending,
                        banner.lifecycle === 'purchased' && styles.statusPurchased,
                        banner.lifecycle === 'rejected' && styles.statusRejected,
                      ]}
                    >
                      {banner.lifecycleLabel || banner.statusLabel}
                    </Text>
                    {banner.lifecycle === 'active' ? (
                      <>
                        <Text style={styles.bannerCardMeta}>
                          Hiệu lực {formatExpiry(banner.startDate)} → {formatExpiry(banner.endDate)}
                        </Text>
                        <Text style={styles.bannerCardMeta}>
                          Số click: {Number(banner.clickCount) || 0}
                        </Text>
                      </>
                    ) : null}
                    {banner.lifecycle === 'rejected' && banner.violationReason ? (
                      <Text style={styles.rejectReason}>Lý do: {banner.violationReason}</Text>
                    ) : null}
                  </Pressable>
                ))
              )}
            </>
          ) : (
            <>
              <WalletBalanceTopUpBar
                balance={data?.walletBalance ?? 0}
                onTopUp={() => onOpenWallet?.()}
              />
              <Text style={styles.sectionHintTop}>Có thể mua nhiều gói để treo song song.</Text>
              {plans.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="pricetag-outline" size={28} color="#94a3b8" />
                  <Text style={styles.emptyCardTitle}>Chưa có gói banner</Text>
                  <Text style={styles.emptyCardBody}>Liên hệ admin để cấu hình gói quảng cáo.</Text>
                </View>
              ) : (
                plans.map((plan) => {
                  const days = Number(plan.durationDays) || 7;
                  return (
                    <View key={plan.id} style={styles.planCard}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planMeta}>
                        {days} ngày · {formatPrice(plan.price)}
                      </Text>
                      {plan.description ? (
                        <Text style={styles.planDescription}>{plan.description}</Text>
                      ) : null}
                      <Pressable
                        style={[styles.primaryBtn, Boolean(buyingPlan) && styles.disabled]}
                        disabled={Boolean(buyingPlan)}
                        onPress={() => handlePurchase(plan)}
                      >
                        {buyingPlan === plan.id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.primaryBtnText}>Mua ngay</Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })
              )}
              <Text style={styles.buyFootnote}>
                Sau khi mua, chọn gói ở tab Gói đang có để tải ảnh và gửi admin duyệt treo.
              </Text>
            </>
          )}
          </PlanTabPanel>
        </>
      )}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  centered: { paddingVertical: 40, alignItems: 'center' },
  sectionHintTop: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 0,
    marginBottom: 10,
    lineHeight: 17,
  },
  buyFootnote: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#94a3b8',
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    gap: 8,
    marginBottom: 12,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyCardBody: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionHint: { color: '#64748b', fontSize: 12, marginBottom: 10 },
  empty: { color: '#94a3b8', marginBottom: 12 },
  bannerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  bannerCardActive: {
    borderColor: t.primary,
    backgroundColor: '#F0FDF4',
  },
  bannerCardTitle: { fontWeight: '800', color: '#0f172a' },
  bannerCardMeta: { color: '#64748b', fontSize: 12, marginTop: 4 },
  bannerCardStatus: { fontWeight: '700', marginTop: 6, fontSize: 12, color: '#64748b' },
  statusPurchased: { color: '#b45309' },
  statusPending: { color: '#0369a1' },
  statusActive: { color: t.primary },
  statusRejected: { color: '#b91c1c' },
  formHint: { color: '#64748b', fontSize: 12, marginTop: 2 },
  rejectReason: { color: '#b91c1c', fontSize: 12, marginTop: 4 },
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  activeTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  activeMeta: { color: '#64748b', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 4 },
  targetRow: { flexDirection: 'row', gap: 8 },
  targetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  targetChipActive: {
    borderColor: t.primary,
    backgroundColor: '#E6F4EC',
  },
  targetChipText: { fontWeight: '700', color: '#475569', fontSize: 12 },
  targetChipTextActive: { color: t.primary },
  productPicker: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  productPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productPickerThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  productPickerText: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '600',
  },
  productPickerPlaceholder: { color: '#94a3b8', fontWeight: '600' },
  productThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  productThumbPlaceholderText: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 11,
  },
  imagePicker: {
    height: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  imagePickerText: { color: '#64748b', fontWeight: '600' },
  preview: { width: '100%', height: '100%' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: t.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.55 },
  lockHint: { color: '#64748b', fontSize: 12, marginTop: 6 },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  planName: { fontWeight: '800', color: '#0f172a', fontSize: 15 },
  planMeta: { color: '#64748b', marginTop: 4 },
  planDescription: { color: '#475569', marginTop: 6, fontSize: 13 },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    ...BOTTOM_SHEET_BORDER,
    maxHeight: '70%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  modalTitle: { fontWeight: '800', fontSize: 16, marginBottom: 10 },
  modalList: { maxHeight: 360 },
  modalListContent: { paddingBottom: 4 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemSelected: {
    backgroundColor: '#E6F4EC',
    borderBottomColor: 'transparent',
  },
  modalItemThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  modalItemText: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 14,
  },
  modalClose: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  modalCloseText: { color: t.primary, fontWeight: '800' },
});

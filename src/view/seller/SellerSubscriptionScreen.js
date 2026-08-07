import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  loadSellerSubscriptionViewModel,
  purchaseSellerSubscriptionViewModel,
} from '../../viewmodel/seller/sellerSubscriptionViewModel';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import { formatPrice } from '../../core/utils/productFormat';
import { isSameData } from '../../core/utils/realtimeList';
import ProfileSubScreen from '../profile/ProfileSubScreen';
import { useResourceSocket } from '../../hooks/useResourceSocket';
import WalletBalanceTopUpBar from '../shared/components/WalletBalanceTopUpBar';
import PlanTabPanel from '../shared/components/PlanTabPanel';

const PLAN_SCREEN_TABS = [
  { key: 'owned', label: 'Gói đang có' },
  { key: 'buy', label: 'Mua gói' },
];

function formatExpiry(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('vi-VN');
  } catch {
    return '';
  }
}

function getDailyPrice(plan) {
  const days = Math.max(1, Number(plan?.durationDays) || 30);
  const price = Math.max(0, Number(plan?.price) || 0);
  return Math.round(price / days);
}

function getPlanAccent(index, total) {
  if (total >= 2 && index === 1) {
    return 'featured';
  }
  return 'default';
}

const BENEFITS = [
  'Gian hàng hiện công khai trên bản đồ & tìm kiếm',
  'Đăng / sửa sản phẩm không giới hạn số lượng trong thời hạn gói',
  'Được mua Banner quảng cáo khi gói còn hiệu lực',
  'Gia hạn cộng dồn ngày còn lại của gói hiện tại',
];

function formatPlanDuration(plan) {
  const days = Number(plan?.durationDays) || 0;
  const months =
    Number(plan?.durationMonths) || Number(plan?.planMonths) || Math.round(days / 30);
  if (months >= 1 && (!days || days % 30 === 0)) {
    return `${months} tháng`;
  }
  if (days > 0) {
    return `${days} ngày`;
  }
  return '—';
}

export default function SellerSubscriptionScreen({ onBack, onOpenWallet, onOpenBanner }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [buyingPlan, setBuyingPlan] = useState(null);
  const [screenTab, setScreenTab] = useState('owned');

  const plans = useMemo(() => {
    const rows = Array.isArray(data?.plans) ? [...data.plans] : [];
    return rows.sort((left, right) => Number(left.price) - Number(right.price));
  }, [data?.plans]);

  const baseDaily = useMemo(() => {
    if (plans[0]) {
      return getDailyPrice(plans[0]);
    }
    return 0;
  }, [plans]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const result = await loadSellerSubscriptionViewModel();
      // Giữ nguyên state nếu dữ liệu không đổi → không nháy nội dung.
      setData((current) => (isSameData(current, result) ? current : result));
    } catch (error) {
      if (!silent) {
        Alert.alert('Lỗi', error.message || 'Không tải được thông tin gói.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubscriptionRealtime = useCallback(
    (payload) => {
      const type = String(payload?.type || '').trim();
      if (type !== 'subscription' && type !== 'wallet') {
        return;
      }
      load({ silent: true });
    },
    [load]
  );

  useResourceSocket({
    enabled: true,
    onResourceUpdated: handleSubscriptionRealtime,
  });

  async function handlePurchase(plan) {
    const planName = plan.name || plan.label || 'gói';
    Alert.alert(
      'Xác nhận mua gói',
      `Trừ ${formatPrice(plan.price)} từ ví để đăng ký ${planName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Mua ngay',
          onPress: async () => {
            setBuyingPlan(plan.id);
            try {
              const result = await purchaseSellerSubscriptionViewModel(plan.id);
              const wasActive = Boolean(data?.subscriptionActive);
              setData(result);
              setScreenTab('owned');
              Alert.alert(
                'Đã kích hoạt',
                wasActive
                  ? 'Đã cộng dồn thời hạn vào gói hiện tại. Xem chi tiết các lần mua bên dưới.'
                  : 'Gói bán hàng đã được mở. Gian hàng sẽ hiện công khai cho người mua gần bạn.'
              );
            } catch (error) {
              const message = error.message || 'Không mua được gói.';
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

  const isActive = Boolean(data?.subscriptionActive);
  const purchases = Array.isArray(data?.purchases) ? data.purchases : [];

  return (
    <ProfileSubScreen title="Gói bán hàng" onBack={onBack}>
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={t.primary} size="large" />
          <Text style={styles.loadingText}>Đang tải gói...</Text>
        </View>
      ) : (
        <>
          <PlanTabPanel
            tabs={PLAN_SCREEN_TABS}
            activeTab={screenTab}
            onChangeTab={setScreenTab}
          >
          {screenTab === 'owned' ? (
            <>
              {isActive ? (
                <View style={styles.statusBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={t.primary} />
                  <Text style={styles.statusBannerText}>Gói bán hàng đang có hiệu lực</Text>
                </View>
              ) : (
                <View style={styles.statusBannerMuted}>
                  <Text style={styles.statusBannerTextMuted}>
                    Chưa có gói đang hiệu lực. Chuyển sang tab Mua gói để đăng ký.
                  </Text>
                </View>
              )}

              {purchases.length > 0 ? (
                <View style={styles.purchaseList}>
                  {purchases.map((item, index) => (
                    <View key={String(item.id || index)} style={styles.purchaseCard}>
                      <Text style={styles.purchaseMeta}>
                        Ngày mua: {formatExpiry(item.ngayMua || item.purchasedAt || item.createdAt)}
                      </Text>
                      <Text style={styles.purchaseMeta}>
                        Ngày có hiệu lực: {formatExpiry(item.effectiveFrom || item.startDate)}
                      </Text>
                      <Text style={styles.purchaseMeta}>
                        Ngày hết hạn: {formatExpiry(item.expiresAt || item.endDate)}
                      </Text>
                      {item.amount ? (
                        <Text style={styles.purchaseAmount}>{formatPrice(item.amount)}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="file-tray-outline" size={28} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>Chưa có gói nào</Text>
                  <Text style={styles.emptyBody}>
                    Lịch sử mua gói sẽ hiển thị tại đây. Bấm tab Mua gói để chọn gói phù hợp.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <WalletBalanceTopUpBar
                balance={data?.walletBalance ?? 0}
                onTopUp={() => onOpenWallet?.()}
              />
              <Text style={styles.sectionLabel}>Quyền lợi gói</Text>
              <View style={styles.benefitCard}>
                {BENEFITS.map((item) => (
                  <View key={item} style={styles.benefitRow}>
                    <View style={styles.benefitIcon}>
                      <Ionicons name="checkmark" size={14} color={t.primary} />
                    </View>
                    <Text style={styles.benefitText}>{item}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Chọn gói phù hợp</Text>
              {plans.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="diamond-outline" size={28} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>Chưa có gói nào</Text>
                  <Text style={styles.emptyBody}>Vui lòng quay lại sau khi admin cấu hình gói.</Text>
                </View>
              ) : (
                plans.map((plan, index) => {
                  const accent = getPlanAccent(index, plans.length);
                  const featured = accent === 'featured';
                  const daily = getDailyPrice(plan);
                  const savePercent =
                    baseDaily > 0 && daily < baseDaily
                      ? Math.round(((baseDaily - daily) / baseDaily) * 100)
                      : 0;
                  const isBuying = buyingPlan === plan.id;
                  const planName = plan.name || plan.label || 'Gói';

                  return (
                    <View
                      key={String(plan.id || planName)}
                      style={[styles.planCard, featured && styles.planCardFeatured]}
                    >
                      {featured ? (
                        <View style={styles.popularBadge}>
                          <Ionicons name="sparkles" size={12} color="#ffffff" />
                          <Text style={styles.popularBadgeText}>Khuyến nghị</Text>
                        </View>
                      ) : null}

                      <View style={styles.planHeader}>
                        <View style={[styles.planIconWrap, featured && styles.planIconWrapFeatured]}>
                          <Ionicons
                            name="diamond"
                            size={20}
                            color={featured ? '#ffffff' : t.primary}
                          />
                        </View>
                        <View style={styles.planHeaderCopy}>
                          <Text style={[styles.planLabel, featured && styles.planLabelFeatured]}>
                            {planName}
                          </Text>
                          <Text style={styles.planMonths}>{formatPlanDuration(plan)}</Text>
                        </View>
                        {savePercent > 0 ? (
                          <View style={styles.savePill}>
                            <Text style={styles.savePillText}>-{savePercent}%</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.priceRow}>
                        <Text style={[styles.planPrice, featured && styles.planPriceFeatured]}>
                          {formatPrice(plan.price)}
                        </Text>
                        <Text style={styles.planMonthly}>≈ {formatPrice(daily)}/ngày</Text>
                      </View>

                      {plan.description ? (
                        <Text style={styles.planDesc}>{plan.description}</Text>
                      ) : null}

                      <Pressable
                        style={({ pressed }) => [
                          styles.buyBtn,
                          featured ? styles.buyBtnFeatured : styles.buyBtnDefault,
                          Boolean(buyingPlan) && styles.buyBtnDisabled,
                          pressed && !buyingPlan && styles.pressed,
                        ]}
                        disabled={Boolean(buyingPlan)}
                        onPress={() => handlePurchase(plan)}
                      >
                        {isBuying ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <>
                            <Text style={styles.buyBtnText}>
                              {isActive ? 'Gia hạn gói này' : 'Mua ngay'}
                            </Text>
                            <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                          </>
                        )}
                      </Pressable>
                    </View>
                  );
                })
              )}

              <Text style={styles.footnote}>
                Thanh toán trừ trực tiếp từ ví FastMark. Nếu số dư không đủ, hãy nạp ví rồi quay lại
                mua gói.
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
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 14,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: t.primarySoft,
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  statusBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: t.primaryDark,
  },
  statusBannerMuted: {
    marginTop: 0,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusBannerTextMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 18,
  },
  purchaseList: {
    gap: 10,
    marginBottom: 8,
  },
  purchaseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 2,
  },
  purchaseMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
    fontWeight: '600',
  },
  purchaseAmount: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    color: t.primaryDark,
  },
  benefitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyBody: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  planCardFeatured: {
    borderColor: t.primary,
    backgroundColor: '#f0fdf4',
    shadowColor: t.primaryDark,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: t.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  popularBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIconWrapFeatured: {
    backgroundColor: t.primary,
  },
  planHeaderCopy: {
    flex: 1,
  },
  planLabel: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  planLabelFeatured: {
    color: t.primaryDark,
  },
  planMonths: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  savePill: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savePillText: {
    color: t.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  priceRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  planPriceFeatured: {
    color: t.primaryDark,
  },
  planMonthly: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  planDesc: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  buyBtn: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buyBtnDefault: {
    backgroundColor: t.primaryDark,
  },
  buyBtnFeatured: {
    backgroundColor: t.primary,
  },
  buyBtnDisabled: {
    opacity: 0.55,
  },
  buyBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  footnote: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

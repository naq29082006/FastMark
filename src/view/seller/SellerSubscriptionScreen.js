import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getSellerSubscriptionOnBackend,
  purchaseSellerSubscriptionOnBackend,
} from '../../api/sellerSubscriptionApi';
import { formatPrice } from '../../core/utils/productFormat';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import ProfileSubScreen from '../profile/ProfileSubScreen';

function formatExpiry(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('vi-VN');
  } catch {
    return '';
  }
}

export default function SellerSubscriptionScreen({ onBack, onOpenWallet }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [buyingPlan, setBuyingPlan] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const result = await getSellerSubscriptionOnBackend(idToken);
      setData(result);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không tải được thông tin gói.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePurchase(planMonths) {
    Alert.alert(
      'Xác nhận mua gói',
      `Trừ ví để đăng ký gói ${planMonths} tháng?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Mua',
          onPress: async () => {
            setBuyingPlan(planMonths);
            try {
              const idToken = await getCurrentUserIdToken();
              const result = await purchaseSellerSubscriptionOnBackend({
                idToken,
                planMonths,
              });
              setData(result);
              Alert.alert('Thành công', 'Đã kích hoạt gói người bán. Gian hàng sẽ hiện công khai.');
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

  return (
    <ProfileSubScreen title="Gói người bán" onBack={onBack}>
      {isLoading ? (
        <ActivityIndicator color="#076F32" style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>
              {data?.subscriptionActive ? 'Gói đang active' : 'Chưa có gói / đã hết hạn'}
            </Text>
            {data?.subscriptionActive ? (
              <Text style={styles.statusMeta}>
                Còn khoảng {data.daysLeft} ngày · hết hạn {formatExpiry(data.subscriptionExpiresAt)}
              </Text>
            ) : (
              <Text style={styles.statusMeta}>
                Gian hàng và bài viết bị ẩn công khai đến khi bạn mua/gia hạn gói.
              </Text>
            )}
            <Text style={styles.balance}>
              Số dư ví: {formatPrice(data?.walletBalance ?? 0)}
            </Text>
          </View>

          {(data?.plans || []).map((plan) => (
            <View key={plan.planMonths} style={styles.planCard}>
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planPrice}>{formatPrice(plan.price)}</Text>
              <Text style={styles.planDesc}>{plan.description}</Text>
              <Pressable
                style={[styles.buyBtn, buyingPlan === plan.planMonths && styles.buyBtnDisabled]}
                disabled={Boolean(buyingPlan)}
                onPress={() => handlePurchase(plan.planMonths)}
              >
                <Text style={styles.buyBtnText}>
                  {buyingPlan === plan.planMonths ? 'Đang xử lý...' : 'Mua gói này'}
                </Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  balance: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#055528',
  },
  planCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#14532d',
  },
  planPrice: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '900',
    color: '#055528',
  },
  planDesc: {
    marginTop: 6,
    fontSize: 13,
    color: '#475569',
  },
  buyBtn: {
    marginTop: 12,
    backgroundColor: '#076F32',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buyBtnDisabled: {
    opacity: 0.6,
  },
  buyBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});

import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getShopLockAppealStatusOnBackend,
  submitShopLockAppealOnBackend,
} from '../../api/reportApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { selectAuthProfile } from '../../viewmodel/auth/authSelectors';
import { loadUserProfile } from '../../viewmodel/auth/authSlice';
import { showErrorAlert } from '../../core/utils/appAlert';
import AdminAppealCompose from '../shared/components/AdminAppealCompose';
import KeyboardAwareScrollView from '../shared/components/KeyboardAwareScrollView';

export default function ShopLockedScreen({ onManageOrders }) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const [loading, setLoading] = useState(true);
  const [appealState, setAppealState] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const shopName =
    profile?.shopName || 'Gian hàng';
  const shopHandle = profile?.shopUsername ? `@${profile.shopUsername}` : '';

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) {
        showErrorAlert('Phiên đăng nhập đã hết hạn.');
        return;
      }
      const status = await getShopLockAppealStatusOnBackend(idToken);
      setAppealState(status);
      if (status && !status.shopLocked) {
        await dispatch(loadUserProfile());
      }
    } catch (loadError) {
      showErrorAlert(loadError.message || 'Không tải được trạng thái khiếu nại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit({ content, images }) {
    const idToken = await getCurrentUserIdToken();
    if (!idToken) {
      Alert.alert('Thông báo', 'Vui lòng đăng nhập lại.');
      return;
    }

    await submitShopLockAppealOnBackend({
      idToken,
      title: 'Yêu cầu xem xét lại khóa gian hàng',
      content,
      images,
    });

    setShowForm(false);
    Alert.alert('Đã gửi yêu cầu', 'Đang chờ admin xử lý.');
    await refresh();
  }

  const phase = appealState?.phase || 'can_appeal';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAwareScrollView nestedScrollPadding={false} contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="storefront-outline" size={36} color="#b45309" />
        </View>
        <Text style={styles.title}>Gian hàng đã bị khóa</Text>
        <Text style={styles.subtitle}>
          {shopName}
          {shopHandle ? ` (${shopHandle})` : ''} hiện không thể đăng bài hoặc nhận đơn mới cho đến
          khi admin mở khóa. Đơn chờ xác nhận và đang giữ hàng sẽ được hủy tự động; đơn tranh
          chấp và đơn đang giam tiền vẫn quản lý được.
        </Text>

        {typeof onManageOrders === 'function' ? (
          <Pressable style={styles.manageOrdersBtn} onPress={onManageOrders}>
            <Ionicons name="receipt-outline" size={18} color="#076F32" />
            <Text style={styles.manageOrdersBtnText}>Quản lý đơn hàng</Text>
          </Pressable>
        ) : null}

        {loading ? <Text style={styles.muted}>Đang tải trạng thái...</Text> : null}

        {!loading && phase === 'pending' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chờ admin xử lý</Text>
            <Text style={styles.cardBody}>
              Bạn đã gửi yêu cầu xem xét lại. Vui lòng đợi quản trị viên phản hồi.
            </Text>
            {appealState?.appeal?.content ? (
              <Text style={styles.quote}>{appealState.appeal.content}</Text>
            ) : null}
          </View>
        ) : null}

        {!loading && phase === 'rejected' ? (
          <View style={[styles.card, styles.cardDanger]}>
            <Text style={styles.cardTitle}>Yêu cầu đã bị từ chối</Text>
            <Text style={styles.cardBody}>
              {appealState?.appeal?.adminNote ||
                appealState?.message ||
                'Gian hàng vẫn bị khóa. Bạn không thể gửi yêu cầu lại.'}
            </Text>
          </View>
        ) : null}

        {!loading && phase === 'can_appeal' && !showForm ? (
          <Pressable style={styles.primaryBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.primaryBtnText}>Yêu cầu xem xét lại</Text>
          </Pressable>
        ) : null}

        {!loading && phase === 'can_appeal' && showForm ? (
          <AdminAppealCompose
            contentLabel="Nội dung yêu cầu"
            contentPlaceholder="Giải thích vì sao bạn muốn mở lại gian hàng..."
            submitLabel="Gửi yêu cầu"
            onCancel={() => setShowForm(false)}
            onSubmit={handleSubmit}
          />
        ) : null}

        <Pressable style={styles.refreshBtn} onPress={refresh} disabled={refreshing}>
          <Text style={styles.refreshText}>
            {refreshing ? 'Đang làm mới...' : 'Làm mới trạng thái'}
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fffbeb' },
  content: { padding: 24, paddingBottom: 40 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  muted: {
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardDanger: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  cardBody: { fontSize: 14, color: '#475569', lineHeight: 20 },
  quote: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#076F32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  manageOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#076F32',
    backgroundColor: '#ffffff',
  },
  manageOrdersBtnText: { color: '#076F32', fontWeight: '800', fontSize: 15 },
  refreshBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  refreshText: { color: '#0369a1', fontWeight: '700' },
});

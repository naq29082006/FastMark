import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

import { selectIsSeller } from '../../viewmodel/auth/authSelectors';
import { LockIcon } from '../shared/components/LockIcon';

function SellerPostScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Đăng tin</Text>
        <Text style={styles.subtitle}>Đăng sản phẩm hoặc quảng bá gian hàng của bạn</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>📸</Text>
        <Text style={styles.cardTitle}>Tạo tin đăng mới</Text>
        <Text style={styles.cardText}>
          Thêm ảnh, mô tả, giá và địa điểm để người mua dễ tìm thấy bạn trên bản đồ.
        </Text>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Bắt đầu đăng tin</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LockedPostScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Đăng tin</Text>
        <Text style={styles.subtitle}>Tính năng dành cho người bán hàng</Text>
      </View>

      <View style={[styles.card, styles.lockedCard]}>
        <View style={styles.lockIconWrap}>
          <LockIcon color="#3a7d74" size={88} />
        </View>
        <Text style={styles.lockedTitle}>Tính năng đang khóa</Text>
        <Text style={styles.lockedText}>
          Bạn cần đăng ký người bán hàng để mở khóa tính năng này.
        </Text>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Đăng ký người bán hàng</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function PostScreen() {
  const isSeller = useSelector(selectIsSeller);

  if (!isSeller) {
    return <LockedPostScreen />;
  }

  return <SellerPostScreen />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
    paddingHorizontal: 20,
    paddingTop: 52,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  lockedCard: {
    paddingTop: 32,
    paddingBottom: 28,
  },
  lockIconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#e8f3f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  lockedText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#0d7377',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});

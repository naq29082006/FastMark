import { View, StyleSheet, Text, Pressable } from 'react-native';

import SellerPostForm from '../home/SellerPostForm';

export default function SellerPostTabScreen({ onProductCreated, onProductChanged }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Đăng tin</Text>
        <Text style={styles.subtitle}>Tạo sản phẩm mới cho gian hàng của bạn</Text>
      </View>
      <SellerPostForm
        onProductCreated={(productId) => {
          onProductChanged?.();
          onProductCreated?.(productId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
});

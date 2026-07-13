import { ScrollView, StyleSheet, Text, View, Pressable, TextInput } from 'react-native';

const CATEGORIES = [
  { id: 'farm', label: 'Nông sản', icon: '🌿' },
  { id: 'food', label: 'Thực phẩm', icon: '🍗' },
  { id: 'electronics', label: 'Điện tử', icon: '💻' },
  { id: 'fashion', label: 'Thời trang', icon: '👕' },
  { id: 'home', label: 'Gia dụng', icon: '🛋️' },
  { id: 'pets', label: 'Thú cưng', icon: '🐾' },
  { id: 'plants', label: 'Cây cảnh', icon: '🪴' },
  { id: 'other', label: 'Khác', icon: '⋯' },
];

const PRODUCTS = [
  { id: '1', name: 'Táo xanh hữu cơ', price: '45.000đ', location: 'Ba Đình', emoji: '🍏' },
  { id: '2', name: 'Gạo ST25 túi 5kg', price: '120.000đ', location: 'Cầu Giấy', emoji: '🌾' },
  { id: '3', name: 'Áo thun cotton', price: '89.000đ', location: 'Đống Đa', emoji: '👕' },
  { id: '4', name: 'Tai nghe Bluetooth', price: '250.000đ', location: 'Hà Đông', emoji: '🎧' },
  { id: '5', name: 'Cây cảnh mini', price: '35.000đ', location: 'Tây Hồ', emoji: '🪴' },
  { id: '6', name: 'Thức ăn cho mèo', price: '55.000đ', location: 'Thanh Xuân', emoji: '🐱' },
];

export default function ProductsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>🏪</Text>
        </View>
        <Text style={styles.brand}>FastMark</Text>
      </View>

      <View style={styles.searchRow}>
        <Pressable style={styles.searchFilter}>
          <Text style={styles.searchFilterText}>Sản phẩm</Text>
          <Text style={styles.searchFilterCaret}>▾</Text>
        </Pressable>
        <View style={styles.searchInputWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Tìm kiếm..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={styles.categoryGrid}>
        {CATEGORIES.map((item) => (
          <Pressable key={item.id} style={styles.categoryItem}>
            <View style={styles.categoryIconWrap}>
              <Text style={styles.categoryIcon}>{item.icon}</Text>
            </View>
            <Text style={styles.categoryLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tổng hợp sản phẩm</Text>
        <Pressable>
          <Text style={styles.sectionLink}>Tất cả</Text>
        </Pressable>
      </View>

      <View style={styles.productGrid}>
        {PRODUCTS.map((product) => (
          <Pressable key={product.id} style={styles.productCard}>
            <View style={styles.productImage}>
              <Text style={styles.productEmoji}>{product.emoji}</Text>
            </View>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.productPrice}>{product.price}</Text>
            <Text style={styles.productLocation}>📍 {product.location}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  content: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 22,
  },
  brand: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0d7377',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  searchFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  searchFilterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  searchFilterCaret: {
    fontSize: 12,
    color: '#6b7280',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    paddingVertical: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  categoryItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  categoryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryIcon: {
    fontSize: 26,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2937',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0d7377',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 12,
  },
  productCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productImage: {
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  productEmoji: {
    fontSize: 48,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
    minHeight: 36,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d7377',
    marginBottom: 4,
  },
  productLocation: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
});

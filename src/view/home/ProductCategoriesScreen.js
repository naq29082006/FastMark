import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import CircularBackButton from '../shared/components/CircularBackButton';
import { useScreenInsets } from '../../hooks/useScreenInsets';

function isRemoteIcon(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function CategoryTile({ label, icon, active, onPress, showGridIcon = false }) {
  const iconValue = String(icon || '').trim();
  const showRemoteImage = isRemoteIcon(iconValue);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryTile,
        active && styles.categoryTileActive,
        pressed && styles.categoryTilePressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.categoryIconBox, active && styles.categoryIconBoxActive]}>
        {showGridIcon ? (
          <Ionicons name="grid-outline" size={24} color={active ? '#0d7377' : '#64748b'} />
        ) : showRemoteImage ? (
          <Image source={{ uri: iconValue }} style={styles.categoryIconImage} />
        ) : iconValue ? (
          <Text style={styles.categoryIconEmoji}>{iconValue}</Text>
        ) : (
          <Ionicons name="pricetag-outline" size={22} color="#64748b" />
        )}
      </View>
      <Text style={[styles.categoryTileName, active && styles.categoryTileNameActive]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProductCategoriesScreen({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onBack,
}) {
  const insets = useScreenInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.headerPaddingTop }]}>
        <CircularBackButton onPress={onBack} variant="plain" />
        <Text style={styles.headerTitle}>Tất cả danh mục</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          <CategoryTile
            label="Tất cả sản phẩm"
            showGridIcon
            active={!selectedCategoryId}
            onPress={() => onSelectCategory('')}
          />
          {categories.map((category) => (
            <CategoryTile
              key={category.id}
              label={category.categoryName}
              icon={category.icon || ''}
              active={selectedCategoryId === category.id}
              onPress={() => onSelectCategory(category.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryTile: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  categoryTileActive: {
    borderColor: '#0d7377',
    backgroundColor: '#ecfdf5',
  },
  categoryTilePressed: {
    opacity: 0.9,
  },
  categoryIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryIconBoxActive: {
    backgroundColor: '#d1fae5',
  },
  categoryIconImage: {
    width: 30,
    height: 30,
    borderRadius: 6,
    resizeMode: 'cover',
  },
  categoryIconEmoji: {
    fontSize: 24,
  },
  categoryTileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 18,
  },
  categoryTileNameActive: {
    color: '#0d7377',
  },
});

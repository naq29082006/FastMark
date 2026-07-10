import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';

import { getProductCategoriesOnBackend } from '../../api/productApi';
import AddressSearchBar from '../map/AddressSearchBar';

export default function SearchScreen({ onSelectLocation }) {
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      setIsLoadingCategories(true);
      try {
        const items = await getProductCategoriesOnBackend();
        if (isMounted) {
          setCategories(items);
        }
      } catch {
        if (isMounted) {
          setCategories([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Tìm kiếm</Text>
        <Text style={styles.subtitle}>Tìm địa điểm, sản phẩm và gian hàng gần bạn</Text>
      </View>

      <View style={styles.searchSection}>
        <AddressSearchBar
          placeholder="Tìm đường, địa điểm, gian hàng..."
          onSelectResult={onSelectLocation}
        />
      </View>

      <View style={styles.quickSearchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          placeholder="Tìm sản phẩm theo tên..."
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
        />
      </View>

      <Text style={styles.sectionTitle}>Danh mục kinh doanh</Text>
      {isLoadingCategories ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#0d7377" />
        </View>
      ) : (
        <View style={styles.categoryGrid}>
          {categories.map((item) => (
            <Pressable key={item.id} style={styles.categoryItem}>
              <View style={styles.categoryIconWrap}>
                <Text style={styles.categoryIcon}>{item.categoryName?.charAt(0) || '•'}</Text>
              </View>
              <Text style={styles.categoryLabel}>{item.categoryName}</Text>
            </Pressable>
          ))}
        </View>
      )}
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
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  quickSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2937',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
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
    fontSize: 22,
    fontWeight: '800',
    color: '#0d7377',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});

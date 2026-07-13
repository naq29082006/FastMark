import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { getProductCategoriesOnBackend } from '../../api/productApi';
import { formatDistance, hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';
import { searchRegisteredShops } from '../../repository/searchShopRepository';
import AddressSearchBar from '../map/AddressSearchBar';

const DISTANCE_OPTIONS = [
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
];

const SEARCH_DEBOUNCE_MS = 450;

function CategoryChip({ label, icon, active, onPress }) {
  return (
    <Pressable
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      {icon ? <Text style={styles.filterChipIcon}>{icon}</Text> : null}
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SearchScreen({ onSelectLocation, onOpenStore }) {
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [isLocating, setIsLocating] = useState(true);

  const [shopQuery, setShopQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [shopCategoryId, setShopCategoryId] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(2000);

  const [results, setResults] = useState([]);
  const [resultCount, setResultCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const searchTimerRef = useRef(null);
  const searchRequestIdRef = useRef(0);

  const selectedRadiusLabel =
    DISTANCE_OPTIONS.find((option) => option.value === radiusMeters)?.label || '2 km';

  const hasActiveFilters = Boolean(
    shopQuery.trim() || productQuery.trim() || shopCategoryId
  );

  const loadLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError('Cần quyền vị trí để tìm quán gần bạn.');
        setCurrentLocation(null);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(normalizeExpoLocation(position));
    } catch {
      setLocationError('Không lấy được vị trí hiện tại. Thử lại sau.');
      setCurrentLocation(null);
    } finally {
      setIsLocating(false);
    }
  }, []);

  const runSearch = useCallback(async () => {
    if (!hasValidLocation(currentLocation)) {
      setResults([]);
      setResultCount(0);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    setIsSearching(true);
    setSearchError('');

    try {
      const payload = await searchRegisteredShops({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radiusMeters,
        shopQuery: shopQuery.trim(),
        shopCategoryId,
        productQuery: productQuery.trim(),
      });

      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      setResults(payload.shops);
      setResultCount(payload.count);
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      setResults([]);
      setResultCount(0);
      setSearchError(error.message || 'Không tìm được gian hàng.');
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [
    currentLocation,
    radiusMeters,
    shopQuery,
    shopCategoryId,
    productQuery,
  ]);

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
    loadLocation();

    return () => {
      isMounted = false;
    };
  }, [loadLocation]);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!hasValidLocation(currentLocation)) {
      return undefined;
    }

    searchTimerRef.current = setTimeout(() => {
      runSearch();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [currentLocation, runSearch]);

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>Tìm kiếm</Text>
          <Text style={styles.subtitle}>
            Tìm quán theo tên quán, tên sản phẩm, loại quán và khoảng cách (tối đa 10 km)
          </Text>
        </View>

        <View style={styles.searchSection}>
          <AddressSearchBar
            placeholder="Tìm địa điểm trên bản đồ..."
            onSelectResult={onSelectLocation}
          />
        </View>

        <View style={styles.locationRow}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Vị trí tìm kiếm</Text>
            <Text style={styles.locationValue}>
              {isLocating
                ? 'Đang lấy vị trí...'
                : hasValidLocation(currentLocation)
                  ? 'Vị trí hiện tại của bạn'
                  : locationError || 'Chưa có vị trí'}
            </Text>
          </View>
          <Pressable style={styles.locationRefreshBtn} onPress={loadLocation}>
            <Text style={styles.locationRefreshText}>Cập nhật</Text>
          </Pressable>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Tên quán</Text>
          <TextInput
            value={shopQuery}
            onChangeText={setShopQuery}
            placeholder="VD: Cà phê Góc Phúc Diễn, @tenquán... (cũng tìm theo tên sản phẩm)"
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
            returnKeyType="search"
          />

          <Text style={styles.inputLabel}>Tên sản phẩm</Text>
          <TextInput
            value={productQuery}
            onChangeText={setProductQuery}
            placeholder="VD: phở bò, trà sữa trân châu, cà phê sữa đá..."
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
            returnKeyType="search"
          />
          <Text style={styles.inputHint}>
            Chỉ nhập tên quán: tìm theo tên quán hoặc sản phẩm. Nhập cả hai: lọc quán và sản phẩm cùng lúc.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Khoảng cách</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {DISTANCE_OPTIONS.map((option) => (
            <CategoryChip
              key={option.value}
              label={option.label}
              active={radiusMeters === option.value}
              onPress={() => setRadiusMeters(option.value)}
            />
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Loại quán</Text>
        {isLoadingCategories ? (
          <ActivityIndicator color="#0d7377" style={styles.inlineLoader} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <CategoryChip
              label="Tất cả"
              active={!shopCategoryId}
              onPress={() => setShopCategoryId('')}
            />
            {categories.map((item) => (
              <CategoryChip
                key={`shop-${item.id}`}
                label={item.categoryName}
                active={shopCategoryId === String(item.id)}
                onPress={() =>
                  setShopCategoryId((current) =>
                    current === String(item.id) ? '' : String(item.id)
                  )
                }
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>
            {hasActiveFilters ? 'Kết quả phù hợp' : 'Quán gần bạn'}
          </Text>
          <Text style={styles.resultMeta}>
            {selectedRadiusLabel}
            {resultCount > 0 ? ` • ${resultCount} quán` : ''}
          </Text>
        </View>

        {searchError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{searchError}</Text>
          </View>
        ) : null}
      </View>
    ),
    [
      categories,
      hasActiveFilters,
      isLoadingCategories,
      isLocating,
      loadLocation,
      locationError,
      currentLocation,
      onSelectLocation,
      productQuery,
      radiusMeters,
      resultCount,
      searchError,
      selectedRadiusLabel,
      shopCategoryId,
      shopQuery,
    ]
  );

  function renderResultItem({ item }) {
    return (
      <Pressable
        style={({ pressed }) => [styles.resultCard, pressed && styles.resultCardPressed]}
        onPress={() => onOpenStore?.(item.id)}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.resultThumb} />
        ) : (
          <View style={styles.resultThumbPlaceholder}>
            <Text style={styles.resultThumbEmoji}>🏪</Text>
          </View>
        )}

        <View style={styles.resultBody}>
          <View style={styles.resultTopRow}>
            <Text style={styles.resultName} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceBadgeText}>
                {formatDistance(item.distance_meters)}
              </Text>
            </View>
          </View>

          {item.category_name ? (
            <Text style={styles.resultCategory}>{item.category_name}</Text>
          ) : null}

          {item.matched_products?.length ? (
            <Text style={styles.resultMatch} numberOfLines={2}>
              Sản phẩm: {item.matched_products.join(', ')}
            </Text>
          ) : null}

          <Text style={styles.resultMetaLine} numberOfLines={1}>
            {item.product_count || 0} sản phẩm
            {item.rating_avg ? ` • ★ ${item.rating_avg.toFixed(1)}` : ''}
            {item.is_open ? ' • Đang mở' : ''}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderResultItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !isSearching && hasValidLocation(currentLocation) ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>Không có quán trong bán kính</Text>
              <Text style={styles.emptyText}>
                Thử tăng khoảng cách, bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isSearching ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color="#0d7377" />
              <Text style={styles.footerLoaderText}>Đang tìm quán gần bạn...</Text>
            </View>
          ) : (
            <View style={styles.footerSpacer} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  listContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  locationRefreshBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ecfdf5',
  },
  locationRefreshText: {
    color: '#0f766e',
    fontWeight: '800',
    fontSize: 12,
  },
  inputCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginTop: 4,
  },
  inputHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    lineHeight: 16,
    marginTop: 2,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  filterChip: {
    minWidth: 72,
    maxWidth: 120,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  filterChipIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  filterChipTextActive: {
    color: '#0f766e',
    fontWeight: '800',
  },
  inlineLoader: {
    marginVertical: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  resultMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  resultCard: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resultCardPressed: {
    opacity: 0.9,
    backgroundColor: '#f0fdfa',
  },
  resultThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  resultThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultThumbEmoji: {
    fontSize: 24,
  },
  resultBody: {
    flex: 1,
  },
  resultTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  resultName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 20,
  },
  distanceBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ecfdf5',
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
  },
  resultCategory: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  resultMatch: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  resultMetaLine: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  emptyBox: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  footerSpacer: {
    height: 8,
  },
});

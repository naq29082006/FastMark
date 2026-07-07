import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { getStoreTypeEmoji, MOCK_VISITED_STORES } from '../../data/activityMockData';
import { MOCK_STORES } from '../../data/storeMockData';
import { calculateDistanceMeters, formatDistance, normalizeExpoLocation } from '../../utils/geo';
import ProfileSubScreen from './ProfileSubScreen';

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeVisitTime(iso) {
  if (!iso) return '';

  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `Ghé thăm ${diffHours} giờ trước`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `Ghé thăm ${diffDays} ngày trước`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  return `Ghé thăm ${diffMonths} tháng trước`;
}

function formatRating(rating) {
  const value = Number(rating);
  if (!Number.isFinite(value)) {
    return '--';
  }
  return value.toFixed(1);
}

export default function VisitedStoresScreen({ onBack, onOpenStore }) {
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!isMounted || permission.status !== 'granted') {
          return;
        }

        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 60000,
          requiredAccuracy: 300,
        }).catch(() => null);

        if (lastKnown && isMounted) {
          setCurrentLocation(normalizeExpoLocation(lastKnown));
          return;
        }

        const precise = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);

        if (precise && isMounted) {
          setCurrentLocation(normalizeExpoLocation(precise));
        }
      } catch (_error) {
        // Leave distance blank if location cannot be obtained.
      }
    }

    loadLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const visitedStores = useMemo(() => {
    return MOCK_VISITED_STORES.map((item) => {
      const store = MOCK_STORES.find((candidate) => String(candidate.id) === String(item.storeId));
      const distanceMeters = store
        ? calculateDistanceMeters(currentLocation, {
            latitude: store.latitude,
            longitude: store.longitude,
          })
        : null;

      return {
        ...item,
        store,
        distanceMeters,
      };
    });
  }, [currentLocation]);

  return (
    <ProfileSubScreen title="Gian hàng đã ghé" onBack={onBack}>
      {visitedStores.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cover}>
            <View style={styles.coverBadge}>
              <Text style={styles.coverBadgeText}>Đã ghé gần đây</Text>
            </View>
            <Text style={styles.coverEmoji}>{getStoreTypeEmoji(item.type)}</Text>
          </View>

          <View style={styles.cardRow}>
            <View style={styles.cardInfo}>
              <Text style={styles.storeName}>{item.storeName}</Text>
              <View style={styles.metaInlineRow}>
                <Text style={styles.ratingBadge}>⭐ {formatRating(item.store?.rating_avg)}</Text>
                <Text style={styles.distanceText}>
                  {Number.isFinite(item.distanceMeters) ? formatDistance(item.distanceMeters) : 'Chưa có vị trí'}
                </Text>
              </View>
              <Text style={styles.address}>📍 {item.address}</Text>
              <Text style={styles.visitedAt}>{formatRelativeVisitTime(item.visitedAt)}</Text>
              <Text style={styles.visitedExactTime}>Lần ghé gần nhất: {formatDateTime(item.visitedAt)}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={() => item.storeId && onOpenStore?.(item.storeId)}
          >
            <Text style={styles.actionButtonText}>Xem trên bản đồ</Text>
          </Pressable>
        </View>
      ))}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  cover: {
    height: 96,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  coverBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 118, 110, 0.14)',
  },
  coverBadgeText: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
  },
  coverEmoji: {
    fontSize: 36,
  },
  cardRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardInfo: {
    flex: 1,
  },
  storeName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  metaInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingBadge: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  distanceText: {
    marginLeft: 8,
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  address: {
    marginTop: 10,
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
  },
  visitedAt: {
    marginTop: 6,
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '700',
  },
  visitedExactTime: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    margin: 16,
    marginTop: 14,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  actionButtonPressed: {
    opacity: 0.82,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});

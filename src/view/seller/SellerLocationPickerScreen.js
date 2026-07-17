import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import LeafletMap from '../shared/components/LeafletMap';
import CircularBackButton from '../shared/components/CircularBackButton';
import AddressSearchBar from '../map/AddressSearchBar';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { reverseGeocodeLocation } from '../../viewmodel/map/mapViewModel';
import { hasValidLocation, normalizeExpoLocation } from '../../core/utils/geo';

export default function SellerLocationPickerScreen({
  initialLocation,
  onBack,
  onConfirm,
}) {
  const insets = useScreenInsets();
  const [pickedLocation, setPickedLocation] = useState(
    hasValidLocation(initialLocation) ? initialLocation : null
  );
  const [recenterRequest, setRecenterRequest] = useState(null);
  const [systemAddress, setSystemAddress] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState('');
  const reverseRequestRef = useRef(0);

  const resolveAddress = useCallback(async (location) => {
    if (!hasValidLocation(location)) {
      return;
    }

    const requestId = reverseRequestRef.current + 1;
    reverseRequestRef.current = requestId;

    setIsResolving(true);
    setError('');

    try {
      const displayName = await reverseGeocodeLocation(
        location.latitude,
        location.longitude
      );

      if (reverseRequestRef.current === requestId) {
        setSystemAddress(displayName || '');
      }
    } catch {
      if (reverseRequestRef.current === requestId) {
        setSystemAddress('');
      }
    } finally {
      if (reverseRequestRef.current === requestId) {
        setIsResolving(false);
      }
    }
  }, []);

  useEffect(() => {
    if (hasValidLocation(initialLocation)) {
      resolveAddress(initialLocation);
    }
  }, [initialLocation, resolveAddress]);

  function applyLocation(location) {
    if (!hasValidLocation(location)) {
      return;
    }

    setPickedLocation(location);
    setRecenterRequest({ location, at: Date.now() });
    resolveAddress(location);
  }

  const handleMapEvent = useCallback(
    (payload) => {
      if (payload?.type === 'mapTap' && hasValidLocation(payload.location)) {
        applyLocation(payload.location);
      }
    },
    [resolveAddress]
  );

  function handleSearchSelect(result) {
    if (!result?.latitude || !result?.longitude) {
      return;
    }

    applyLocation({
      latitude: result.latitude,
      longitude: result.longitude,
    });
  }

  async function handleUseCurrentLocation() {
    setIsLocating(true);
    setError('');

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Cần quyền truy cập vị trí để lấy tọa độ.');
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      applyLocation(normalizeExpoLocation(position));
    } catch (locationError) {
      setError(locationError.message || 'Không lấy được vị trí hiện tại.');
    } finally {
      setIsLocating(false);
    }
  }

  function handleConfirm() {
    if (!hasValidLocation(pickedLocation)) {
      setError('Vui lòng chọn vị trí trên bản đồ.');
      return;
    }

    onConfirm?.({
      latitude: pickedLocation.latitude,
      longitude: pickedLocation.longitude,
      systemAddress,
    });
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.contentPaddingTop }]}>
        <CircularBackButton onPress={onBack} variant="plain" style={styles.backButton} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          Chọn vị trí gian hàng
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapArea}>
        <LeafletMap
          currentLocation={pickedLocation}
          recenterRequest={recenterRequest}
          restaurants={[]}
          onEvent={handleMapEvent}
        />

        <View style={styles.searchOverlay} pointerEvents="box-none">
          <AddressSearchBar
            placeholder="Tìm địa chỉ để chọn vị trí..."
            onSelectResult={handleSearchSelect}
          />
        </View>

        <Pressable
          disabled={isLocating}
          onPress={handleUseCurrentLocation}
          style={({ pressed }) => [
            styles.currentLocationButton,
            pressed && styles.pressed,
            isLocating && styles.buttonDisabled,
          ]}
        >
          {isLocating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.currentLocationText}>📍 Vị trí hiện tại</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottomSpacing + 12 }]}>
        <Text style={styles.hintText}>
          Chạm lên bản đồ hoặc tìm kiếm để chọn vị trí gian hàng.
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tọa độ</Text>
          <Text style={styles.infoValue}>
            {hasValidLocation(pickedLocation)
              ? `${pickedLocation.latitude.toFixed(6)}, ${pickedLocation.longitude.toFixed(6)}`
              : 'Chưa chọn'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Địa chỉ hệ thống</Text>
          {isResolving ? (
            <View style={styles.resolvingRow}>
              <ActivityIndicator color="#0d7377" size="small" />
              <Text style={styles.resolvingText}>Đang lấy địa chỉ...</Text>
            </View>
          ) : (
            <Text style={styles.infoValue} numberOfLines={3}>
              {systemAddress || 'Chưa có địa chỉ'}
            </Text>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          disabled={!hasValidLocation(pickedLocation) || isResolving}
          onPress={handleConfirm}
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.pressed,
            (!hasValidLocation(pickedLocation) || isResolving) && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.confirmButtonText}>Xác nhận vị trí</Text>
        </Pressable>
      </View>
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
    gap: 8,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  searchOverlay: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 15,
    paddingHorizontal: 14,
  },
  currentLocationButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d7377',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 20,
  },
  currentLocationText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    marginTop: -18,
  },
  hintText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 14,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
    lineHeight: 20,
  },
  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resolvingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  confirmButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d7377',
    marginTop: 4,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
});

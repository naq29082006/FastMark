import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getPublicUserProfileOnBackend } from '../../api/userDiscoveryApi';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import AvatarBadge from '../shared/components/AvatarBadge';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { showErrorAlert } from '../../core/utils/appAlert';

function formatCount(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) {
    return `${(number / 1000000).toFixed(1).replace('.0', '')}M`;
  }
  if (number >= 1000) {
    return `${(number / 1000).toFixed(1).replace('.0', '')}k`;
  }
  return String(number);
}

export default function BuyerProfileScreen({
  userId,
  onBack,
  onOpenShop,
}) {
  const insets = useScreenInsets();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      const idToken = await getCurrentUserIdToken();
      const data = await getPublicUserProfileOnBackend(idToken, userId);
      setProfile(data?.user || null);
    } catch (error) {
      showErrorAlert(error.message || 'Không tải được hồ sơ người dùng.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Hồ sơ người dùng" onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" size="large" />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.screen}>
        <SubScreenHeader title="Hồ sơ người dùng" onBack={onBack} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Không tìm thấy người dùng.</Text>
        </View>
      </View>
    );
  }

  const displayName = profile.fullName || profile.userName || 'Người dùng';
  const hasFullName = Boolean(String(profile.fullName || '').trim());
  const username = profile.userName ? `@${String(profile.userName).replace(/^@+/, '')}` : '';
  const shopName = profile.shopName || displayName;
  const headerTitle = hasFullName ? profile.fullName.trim() : displayName;
  const soNguoiTheo = Number(profile.soNguoiTheo) || 0;
  const followingCount = Number(profile.followingCount) || 0;

  return (
    <View style={styles.screen}>
      <SubScreenHeader title={headerTitle} onBack={onBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.nestedScrollPaddingBottom, 24) },
        ]}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroBanner} />
          <View style={styles.heroBody}>
            <View style={styles.avatarWrap}>
              <AvatarBadge name={displayName} uri={profile.avatar} size={104} />
            </View>
            {hasFullName ? (
              <Text style={styles.displayName} numberOfLines={3}>
                {profile.fullName.trim()}
              </Text>
            ) : (
              <Text style={styles.displayName} numberOfLines={2}>
                {displayName}
              </Text>
            )}
            {username ? <Text style={styles.username}>{username}</Text> : null}
            <View style={styles.followRow}>
              <Text style={styles.followText}>
                <Text style={styles.followValue}>{formatCount(followingCount)}</Text>
                {' '}Đang theo dõi
              </Text>
              <View style={styles.followDivider} />
              <Text style={styles.followText}>
                <Text style={styles.followValue}>{formatCount(soNguoiTheo)}</Text>
                {' '}Người theo dõi
              </Text>
            </View>
          </View>
        </View>

        {profile.shopId ? (
          <Pressable
            style={({ pressed }) => [styles.shopCard, pressed && styles.pressed]}
            onPress={() => onOpenShop?.(profile.shopId)}
          >
            <View style={styles.shopCardIcon}>
              <Ionicons name="storefront" size={22} color="#076F32" />
            </View>
            <View style={styles.shopCardBody}>
              <Text style={styles.shopCardTitle}>Gian hàng</Text>
              <Text style={styles.shopCardName} numberOfLines={1}>
                {shopName}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  heroBanner: {
    height: 88,
    backgroundColor: '#076F32',
    opacity: 0.12,
  },
  heroBody: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
    marginTop: -52,
  },
  avatarWrap: {
    padding: 5,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },
  displayName: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  username: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
    color: '#076F32',
    textAlign: 'center',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  followText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  followValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  followDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#cbd5e1',
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shopCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
  },
  shopCardBody: {
    flex: 1,
    gap: 2,
  },
  shopCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  shopCardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  pressed: {
    opacity: 0.88,
  },
});

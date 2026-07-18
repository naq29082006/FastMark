import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatActivityLabel } from '../../core/utils/activityLabel';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import CircularBackButton from '../shared/components/CircularBackButton';
import AvatarBadge from '../shared/components/AvatarBadge';

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

export default function ChatProfileScreen({ peer, peerType = 'shop', onBack, onViewShop }) {
  const insets = useScreenInsets();

  if (!peer) {
    return null;
  }

  // Account view: personal name/username. Never use shop bio for buyers.
  const displayName =
    peer.fullName || peer.name || peer.shopName || 'Người dùng';
  const username = peer.userName || peer.shopUsername || '';
  // Shop peer “Tài khoản”: personal User.Avatar only. Shop logo stays peer.avatar.
  const avatar =
    peerType === 'shop'
      ? peer.accountAvatar || peer.photoUrl || ''
      : peer.avatar || peer.photoUrl || '';
  const followersCount = Number(peer.followersCount) || 0;
  const followingCount = Number(peer.followingCount) || 0;
  const activityLabel =
    peer.accountActivityLabel ||
    peer.activityLabel ||
    formatActivityLabel(
      peer.accountIsOnline ?? peer.isOnline,
      peer.accountLastActiveAt || peer.lastActiveAt
    );
  const isOnline = Boolean(peer.accountIsOnline ?? peer.isOnline);

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.contentPaddingTop }]}>
        <CircularBackButton onPress={onBack} variant="plain" />
        <Text style={styles.topTitle}>Tài khoản</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            <AvatarBadge name={displayName} uri={avatar} size={72} />
            <View style={styles.profileHeaderInfo}>
              <Text style={styles.displayName} numberOfLines={2}>
                {displayName}
              </Text>
              {username ? (
                <Text style={styles.userName} numberOfLines={1}>
                  @{username}
                </Text>
              ) : null}
              <Text style={[styles.activity, isOnline && styles.activityOnline]} numberOfLines={1}>
                {isOnline ? 'Đang hoạt động' : activityLabel}
              </Text>
            </View>
          </View>

          <View style={styles.followRow}>
            {peerType === 'shop' ? (
              <Text style={styles.followText}>
                <Text style={styles.followValue}>{formatCount(followersCount)}</Text> người theo dõi
              </Text>
            ) : (
              <Text style={styles.followText}>
                <Text style={styles.followValue}>{formatCount(followingCount)}</Text> đang theo dõi
              </Text>
            )}
          </View>

          {peerType === 'shop' && onViewShop ? (
            <Pressable
              onPress={onViewShop}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.primaryButtonText}>Xem gian hàng</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  topSpacer: { width: 40 },
  content: { padding: 16 },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileHeaderInfo: { flex: 1, gap: 4 },
  displayName: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  userName: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  activity: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  activityOnline: { color: '#076F32', fontWeight: '700' },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  followText: { fontSize: 14, color: '#475569' },
  followValue: { fontWeight: '800', color: '#0f172a' },
  followDivider: { color: '#cbd5e1' },
  primaryButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  buttonPressed: { opacity: 0.88 },
});

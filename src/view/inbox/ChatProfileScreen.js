import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatActivityLabel } from '../../core/utils/activityLabel';

function ProfileAvatar({ name, avatar }) {
  if (avatar) {
    return <Image source={{ uri: avatar }} style={styles.avatarImage} />;
  }

  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarFallbackText}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function ChatProfileScreen({ peer, peerType = 'shop', onBack, onViewShop }) {
  if (!peer) {
    return null;
  }

  const displayName = peer.name || peer.fullName || peer.shopName || 'Người dùng';
  const username = peer.userName || peer.shopUsername;
  const activityLabel =
    peer.activityLabel || formatActivityLabel(peer.isOnline, peer.lastActiveAt);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.topTitle}>Hồ sơ</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <ProfileAvatar name={displayName} avatar={peer.avatar} />
          <Text style={styles.name}>{displayName}</Text>
          {username ? <Text style={styles.username}>@{username}</Text> : null}
          <Text style={[styles.activity, peer.isOnline && styles.activityOnline]}>
            {activityLabel}
          </Text>
        </View>

        <View style={styles.card}>
          {peer.phone ? (
            <View style={styles.row}>
              <Text style={styles.label}>Số điện thoại</Text>
              <Text style={styles.value}>{peer.phone}</Text>
            </View>
          ) : null}
          {peer.description ? (
            <View style={styles.row}>
              <Text style={styles.label}>Giới thiệu</Text>
              <Text style={styles.value}>{peer.description}</Text>
            </View>
          ) : null}
        </View>

        {peerType === 'shop' && onViewShop ? (
          <Pressable onPress={onViewShop} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Xem gian hàng</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  backButtonText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  topTitle: { flex: 1, textAlign: 'center', color: '#ffffff', fontSize: 16, fontWeight: '800' },
  topSpacer: { width: 36 },
  content: { padding: 20, gap: 16 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e2e8f0',
    marginBottom: 12,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#0d7377',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarFallbackText: { color: '#ffffff', fontSize: 36, fontWeight: '900' },
  name: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  username: { marginTop: 4, fontSize: 14, color: '#0d7377', fontWeight: '700' },
  activity: { marginTop: 8, fontSize: 13, color: '#64748b', fontWeight: '600' },
  activityOnline: { color: '#16a34a' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
  },
  row: { gap: 4 },
  label: { fontSize: 12, color: '#94a3b8', fontWeight: '700' },
  value: { fontSize: 14, color: '#0f172a', lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#0d7377',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
});

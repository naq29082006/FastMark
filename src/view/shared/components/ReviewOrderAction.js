import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ReviewNowButton({ onPress, compact = false }) {
  return (
    <Pressable
      style={({ pressed }) => [
        compact ? styles.compactButton : styles.button,
        pressed && styles.pressed,
      ]}
      onPress={(event) => {
        event?.stopPropagation?.();
        onPress?.(event);
      }}
    >
      <Text style={compact ? styles.compactText : styles.text}>Đánh giá ngay</Text>
    </Pressable>
  );
}

export function ReviewedBadge({ compact = false }) {
  return (
    <View style={[compact ? styles.compactBadge : styles.badge]}>
      <Text style={compact ? styles.compactBadgeText : styles.badgeText}>✓ Đã đánh giá</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
    marginBottom: 10,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  compactButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#076F32',
    marginTop: 14,
  },
  compactText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  badge: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    marginBottom: 10,
  },
  badgeText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '800',
  },
  compactBadge: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    marginTop: 14,
  },
  compactBadgeText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
});

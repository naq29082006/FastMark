import { Pressable, StyleSheet, Text, View } from 'react-native';

import { callStore, contactZalo } from '../../../core/utils/storeContact';

export default function ContactActions({ phone, zalo, compact = false }) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.btn, styles.callBtn, pressed && styles.pressed]}
        onPress={() => callStore(phone)}
      >
        <Text style={styles.btnIcon}>📞</Text>
        {!compact && <Text style={styles.btnText}>Gọi điện</Text>}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.btn, styles.zaloBtn, pressed && styles.pressed]}
        onPress={() => contactZalo(zalo)}
      >
        <Text style={styles.btnIcon}>💬</Text>
        {!compact && <Text style={styles.btnText}>Zalo</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowCompact: {
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  callBtn: {
    backgroundColor: '#0f766e',
  },
  zaloBtn: {
    backgroundColor: '#0068ff',
  },
  pressed: {
    opacity: 0.8,
  },
  btnIcon: {
    fontSize: 18,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { callStore } from '../../../core/utils/storeContact';

function formatPhoneDisplay(phone) {
  const value = String(phone || '').trim();
  return value || 'Chưa cập nhật';
}

export default function ContactActions({ phone }) {
  const displayPhone = formatPhoneDisplay(phone);
  const canCall = Boolean(String(phone || '').trim());

  return (
    <View style={styles.row}>
      <Text style={[styles.infoLine, styles.phoneText]} numberOfLines={2}>
        <Text style={styles.infoLabelInline}>Số điện thoại: </Text>
        <Text style={styles.infoValueInline}>{displayPhone}</Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gọi điện"
        disabled={!canCall}
        style={({ pressed }) => [
          styles.callBtn,
          !canCall && styles.callBtnDisabled,
          pressed && canCall && styles.pressed,
        ]}
        onPress={() => callStore(phone)}
      >
        <Ionicons name="call" size={18} color={canCall ? '#076F32' : '#94a3b8'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  infoLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  phoneText: {
    flex: 1,
    minWidth: 0,
  },
  infoLabelInline: {
    color: '#64748b',
    fontWeight: '700',
  },
  infoValueInline: {
    color: '#0f172a',
    fontWeight: '600',
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#A7D9B8',
  },
  callBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  pressed: {
    opacity: 0.85,
  },
});

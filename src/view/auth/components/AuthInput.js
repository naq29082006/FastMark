import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AUTH_COLORS, AUTH_RADIUS } from './authTheme';

export default function AuthInput({
  label,
  icon,
  rightLabel,
  onRightLabelPress,
  secureTextEntry = false,
  ...props
}) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {rightLabel ? (
          <Pressable onPress={onRightLabelPress} hitSlop={8}>
            <Text style={styles.rightLabel}>{rightLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.inputWrap}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <TextInput
          {...props}
          secureTextEntry={hidden}
          placeholderTextColor="#9ca3af"
          style={[styles.input, icon ? styles.inputWithIcon : null]}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{hidden ? '👁' : '🙈'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: AUTH_COLORS.text,
  },
  rightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AUTH_COLORS.primary,
  },
  inputWrap: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
    borderRadius: AUTH_RADIUS.input,
    backgroundColor: AUTH_COLORS.inputBg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  icon: {
    fontSize: 16,
    marginRight: 10,
    color: '#9ca3af',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: AUTH_COLORS.text,
    paddingVertical: 14,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  eyeIcon: {
    fontSize: 16,
  },
});

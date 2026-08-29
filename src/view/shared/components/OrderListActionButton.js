import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Cỡ chữ body thường dùng trên item đơn (OrderItemHeader ~13). */
const NORMAL_TEXT_SIZE = 13;
const BUTTON_TEXT_SIZE = NORMAL_TEXT_SIZE * 1.4;

const VARIANTS = {
  primary: {
    button: { backgroundColor: '#076F32' },
    text: { color: '#ffffff' },
  },
  danger: {
    button: { backgroundColor: '#DC2626' },
    text: { color: '#ffffff' },
  },
  outline: {
    button: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
    },
    text: { color: '#334155' },
  },
  dangerOutline: {
    button: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#fecaca',
    },
    text: { color: '#b91c1c' },
  },
  warning: {
    button: {
      backgroundColor: '#fff7ed',
      borderWidth: 1,
      borderColor: '#fdba74',
    },
    text: { color: '#c2410c' },
  },
  muted: {
    button: { backgroundColor: '#e2e8f0' },
    text: { color: '#475569' },
  },
};

export function OrderListActionRow({ children, style }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export default function OrderListActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  flex = false,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        flex && styles.buttonFlex,
        palette.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
      onPress={(event) => {
        event?.stopPropagation?.();
        onPress?.(event);
      }}
    >
      <Text style={[styles.text, palette.text, disabled && styles.textDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 10,
  },
  button: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFlex: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  text: {
    fontSize: BUTTON_TEXT_SIZE,
    fontWeight: '700',
    textAlign: 'center',
  },
  textDisabled: {
    opacity: 0.8,
  },
});

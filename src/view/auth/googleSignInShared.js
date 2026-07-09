import { Pressable, StyleSheet, Text } from 'react-native';

export function GoogleSignInPressable({ disabled, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel="Đăng nhập bằng Google"
    >
      <Text style={styles.icon}>G</Text>
      <Text style={styles.label}>Tiếp tục với Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  buttonPressed: {
    backgroundColor: '#f8fafc',
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ea4335',
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
});

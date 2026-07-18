import { StyleSheet, Text, View } from 'react-native';

import { AUTH_COLORS, AUTH_RADIUS } from './authTheme';

export default function AuthBrand({ title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.logoBox}>
        <Text style={styles.logoEmoji}>🧺</Text>
        <Text style={styles.logoText}>FastMark</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: AUTH_RADIUS.logo,
    backgroundColor: AUTH_COLORS.logoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#f3e8c8',
  },
  logoEmoji: {
    fontSize: 28,
  },
  logoText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#055528',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: AUTH_COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: AUTH_COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 12,
    fontWeight: '500',
  },
});

import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VARIANTS = {
  light: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    iconColor: '#ffffff',
  },
  surface: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    iconColor: '#0f172a',
  },
  plain: {
    backgroundColor: 'transparent',
    iconColor: '#0f172a',
  },
};

export default function CircularBackButton({
  onPress,
  variant = 'light',
  size = 36,
  style,
  iconSize,
  accessibilityLabel = 'Quay lại',
}) {
  const palette = VARIANTS[variant] || VARIANTS.light;
  const diameter = size;
  const resolvedIconSize = iconSize || Math.round(diameter * 0.5);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: palette.backgroundColor,
        },
        style,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="chevron-back"
        size={resolvedIconSize}
        color={palette.iconColor}
        style={styles.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginLeft: -1,
  },
  pressed: {
    opacity: 0.72,
  },
});

import { StyleSheet, Text, View } from 'react-native';

export default function OutOfStockOverlay({
  label = 'Hết hàng',
  compact = false,
}) {
  return (
    <View
      style={[styles.overlay, compact && styles.overlayCompact]}
      pointerEvents="none"
    >
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 5,
    elevation: 5,
  },
  overlayCompact: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  label: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 11,
  },
});

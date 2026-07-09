import { StyleSheet, View } from 'react-native';

export function LockIcon({ color = '#3a7d74', size = 72 }) {
  const bodyW = size * 0.62;
  const bodyH = size * 0.48;
  const shackleW = size * 0.42;
  const shackleH = size * 0.34;
  const stroke = Math.max(3, size * 0.05);

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <View
        style={[
          styles.shackle,
          {
            width: shackleW,
            height: shackleH,
            borderRadius: shackleW / 2,
            borderWidth: stroke,
            borderColor: color,
            top: size * 0.06,
          },
        ]}
      />
      <View
        style={[
          styles.body,
          {
            width: bodyW,
            height: bodyH,
            borderRadius: size * 0.08,
            backgroundColor: color,
            top: size * 0.34,
          },
        ]}
      />
      <View
        style={[
          styles.keyhole,
          {
            width: size * 0.1,
            height: size * 0.14,
            borderRadius: size * 0.05,
            backgroundColor: '#ffffff',
            top: size * 0.5,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  shackle: {
    position: 'absolute',
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  body: {
    position: 'absolute',
  },
  keyhole: {
    position: 'absolute',
  },
});

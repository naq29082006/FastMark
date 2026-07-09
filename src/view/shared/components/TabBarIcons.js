import { StyleSheet, View } from 'react-native';

function IconFrame({ children, size = 24 }) {
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {children}
    </View>
  );
}

export function HomeTabIcon({ color, size = 24, filled = false }) {
  const roof = size * 0.34;
  const bodyW = size * 0.56;
  const bodyH = size * 0.34;

  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.homeRoof,
          {
            width: roof,
            height: roof,
            borderColor: color,
            backgroundColor: filled ? color : 'transparent',
            top: size * 0.08,
          },
        ]}
      />
      <View
        style={[
          styles.homeBody,
          {
            width: bodyW,
            height: bodyH,
            borderColor: color,
            backgroundColor: filled ? color : 'transparent',
            top: size * 0.36,
          },
        ]}
      />
    </IconFrame>
  );
}

export function CompassTabIcon({ color, size = 24, filled = false }) {
  const circle = size * 0.72;

  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.circle,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            borderColor: color,
            backgroundColor: filled ? `${color}22` : 'transparent',
          },
        ]}
      />
      <View
        style={[
          styles.compassNeedle,
          {
            width: size * 0.08,
            height: circle * 0.42,
            backgroundColor: color,
            top: size * 0.28,
          },
        ]}
      />
      <View
        style={[
          styles.compassNeedleShort,
          {
            width: size * 0.08,
            height: circle * 0.22,
            backgroundColor: color,
            top: size * 0.52,
            opacity: 0.45,
          },
        ]}
      />
    </IconFrame>
  );
}

export function PlusTabIcon({ color, size = 28 }) {
  const bar = size * 0.62;
  const thickness = Math.max(2, size * 0.09);

  return (
    <IconFrame size={size}>
      <View
        style={{
          position: 'absolute',
          width: bar,
          height: thickness,
          backgroundColor: color,
          borderRadius: thickness,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: thickness,
          height: bar,
          backgroundColor: color,
          borderRadius: thickness,
        }}
      />
    </IconFrame>
  );
}

export function ChatTabIcon({ color, size = 24, filled = false }) {
  const bubbleW = size * 0.78;
  const bubbleH = size * 0.56;

  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.chatBubble,
          {
            width: bubbleW,
            height: bubbleH,
            borderRadius: bubbleH * 0.35,
            borderColor: color,
            backgroundColor: filled ? `${color}18` : 'transparent',
            top: size * 0.1,
          },
        ]}
      />
      <View
        style={[
          styles.chatTail,
          {
            borderTopColor: color,
            left: size * 0.2,
            top: size * 0.58,
          },
        ]}
      />
      <View style={[styles.chatDot, { backgroundColor: color, left: size * 0.3, top: size * 0.34 }]} />
      <View style={[styles.chatDot, { backgroundColor: color, left: size * 0.44, top: size * 0.34 }]} />
      <View style={[styles.chatDot, { backgroundColor: color, left: size * 0.58, top: size * 0.34 }]} />
    </IconFrame>
  );
}

export function PersonTabIcon({ color, size = 24, filled = false }) {
  const head = size * 0.3;

  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.personHead,
          {
            width: head,
            height: head,
            borderRadius: head / 2,
            borderColor: color,
            backgroundColor: filled ? color : 'transparent',
            top: size * 0.12,
          },
        ]}
      />
      <View
        style={[
          styles.personBody,
          {
            width: size * 0.62,
            height: size * 0.3,
            borderColor: color,
            borderTopLeftRadius: size * 0.3,
            borderTopRightRadius: size * 0.3,
            backgroundColor: filled ? color : 'transparent',
            top: size * 0.5,
          },
        ]}
      />
    </IconFrame>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  homeRoof: {
    position: 'absolute',
    borderLeftWidth: 2,
    borderTopWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  homeBody: {
    position: 'absolute',
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  circle: {
    position: 'absolute',
    borderWidth: 2,
  },
  compassNeedle: {
    position: 'absolute',
    borderRadius: 2,
  },
  compassNeedleShort: {
    position: 'absolute',
    borderRadius: 2,
  },
  chatBubble: {
    position: 'absolute',
    borderWidth: 2,
  },
  chatTail: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  chatDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  personHead: {
    position: 'absolute',
    borderWidth: 2,
  },
  personBody: {
    position: 'absolute',
    borderWidth: 2,
    borderBottomWidth: 0,
  },
});

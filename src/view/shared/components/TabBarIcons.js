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

export function SearchTabIcon({ color, size = 24, filled = false }) {
  const lens = size * 0.42;
  const handleLen = size * 0.22;

  return (
    <IconFrame size={size}>
      <View
        style={[
          styles.circle,
          {
            width: lens,
            height: lens,
            borderRadius: lens / 2,
            borderColor: color,
            backgroundColor: filled ? `${color}18` : 'transparent',
            top: size * 0.12,
            left: size * 0.12,
          },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          width: Math.max(2, size * 0.08),
          height: handleLen,
          backgroundColor: color,
          borderRadius: 2,
          transform: [{ rotate: '45deg' }],
          top: size * 0.52,
          left: size * 0.52,
        }}
      />
    </IconFrame>
  );
}

export function BagTabIcon({ color, size = 24, filled = false }) {
  const bagW = size * 0.62;
  const bagH = size * 0.48;

  return (
    <IconFrame size={size}>
      <View
        style={{
          position: 'absolute',
          width: bagW * 0.42,
          height: size * 0.16,
          borderWidth: 2,
          borderColor: color,
          borderBottomWidth: 0,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          top: size * 0.16,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: bagW,
          height: bagH,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 6,
          backgroundColor: filled ? `${color}18` : 'transparent',
          top: size * 0.3,
        }}
      />
    </IconFrame>
  );
}

export function OrdersTabIcon({ color, size = 24, filled = false }) {
  const boxW = size * 0.58;
  const boxH = size * 0.5;

  return (
    <IconFrame size={size}>
      <View
        style={{
          position: 'absolute',
          width: boxW,
          height: boxH,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 4,
          backgroundColor: filled ? `${color}18` : 'transparent',
          top: size * 0.22,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: boxW * 0.55,
          height: 2,
          backgroundColor: color,
          top: size * 0.38,
          left: size * 0.22,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: boxW * 0.4,
          height: 2,
          backgroundColor: color,
          top: size * 0.48,
          left: size * 0.22,
        }}
      />
    </IconFrame>
  );
}

export function ChartTabIcon({ color, size = 24, filled = false }) {
  const barW = size * 0.12;

  return (
    <IconFrame size={size}>
      {[0.22, 0.38, 0.54].map((leftRatio, index) => (
        <View
          key={leftRatio}
          style={{
            position: 'absolute',
            width: barW,
            height: size * (0.22 + index * 0.12),
            backgroundColor: filled ? color : `${color}88`,
            borderRadius: 2,
            bottom: size * 0.18,
            left: size * leftRatio,
          }}
        />
      ))}
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

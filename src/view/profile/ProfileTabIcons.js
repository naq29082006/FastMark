import { StyleSheet, View } from 'react-native';

function IconFrame({ children, size = 22 }) {
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {children}
    </View>
  );
}

function GridCells({ color, size, filled = false }) {
  const gap = size * 0.08;
  const cell = (size - gap) / 2;

  return (
    <View style={[styles.gridWrap, { width: size, height: size, gap }]}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={[
            styles.gridCell,
            {
              width: cell,
              height: cell,
              borderColor: color,
              backgroundColor: filled ? `${color}22` : 'transparent',
            },
          ]}
        />
      ))}
    </View>
  );
}

export function SellerProductTabIcon({ color, size = 22, filled = false }) {
  return (
    <IconFrame size={size}>
      <GridCells color={color} size={size * 0.88} filled={filled} />
      <View
        style={[
          styles.sellerBadge,
          {
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: size * 0.17,
            backgroundColor: color,
            right: -size * 0.02,
            bottom: -size * 0.02,
          },
        ]}
      >
        <View
          style={[
            styles.sellerBadgeInner,
            {
              width: size * 0.12,
              height: size * 0.12,
              borderRadius: size * 0.06,
            },
          ]}
        />
      </View>
    </IconFrame>
  );
}

export function LikedProductTabIcon({ color, size = 22, filled = false }) {
  // Trái tim ghép từ 1 hình vuông xoay 45° + 2 hình tròn hai bên trên
  const body = size * 0.52;
  const lobe = body;
  const opacity = filled ? 1 : 0.85;

  return (
    <IconFrame size={size}>
      <View style={{ width: size, height: size, opacity }}>
        <View
          style={[
            styles.heartPart,
            {
              width: body,
              height: body,
              backgroundColor: color,
              left: (size - body) / 2,
              top: size * 0.3,
              transform: [{ rotate: '45deg' }],
              borderRadius: size * 0.06,
            },
          ]}
        />
        <View
          style={[
            styles.heartPart,
            {
              width: lobe,
              height: lobe,
              borderRadius: lobe / 2,
              backgroundColor: color,
              left: size * 0.04,
              top: size * 0.1,
            },
          ]}
        />
        <View
          style={[
            styles.heartPart,
            {
              width: lobe,
              height: lobe,
              borderRadius: lobe / 2,
              backgroundColor: color,
              right: size * 0.04,
              top: size * 0.1,
            },
          ]}
        />
      </View>
    </IconFrame>
  );
}

export function AllProductTabIcon({ color, size = 22, filled = false }) {
  return (
    <IconFrame size={size}>
      <GridCells color={color} size={size * 0.88} filled={filled} />
    </IconFrame>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    borderWidth: 1.6,
    borderRadius: 3,
  },
  sellerBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerBadgeInner: {
    backgroundColor: '#ffffff',
  },
  heartPart: {
    position: 'absolute',
  },
});

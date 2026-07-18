import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STAR_COLOR = '#f59e0b';
const EMPTY_STAR_COLOR = '#cbd5e1';

function RatingStar({ type, size }) {
  if (type === 'half') {
    return <Ionicons name="star-half" size={size} color={STAR_COLOR} />;
  }

  if (type === 'full') {
    return <Ionicons name="star" size={size} color={STAR_COLOR} />;
  }

  return <Ionicons name="star-outline" size={size} color={EMPTY_STAR_COLOR} />;
}

export default function StarRating({ rating, size = 14, showValue = false }) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const fullStars = Math.floor(safeRating);
  const hasHalf = safeRating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  const stars = [
    ...Array.from({ length: fullStars }, (_, index) => ({ type: 'full', key: `full-${index}` })),
    ...(hasHalf ? [{ type: 'half', key: 'half' }] : []),
    ...Array.from({ length: emptyStars }, (_, index) => ({ type: 'empty', key: `empty-${index}` })),
  ];

  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {stars.map((star) => (
          <RatingStar key={star.key} type={star.type} size={size} />
        ))}
      </View>
      {showValue ? (
        <Text style={[styles.value, { fontSize: size - 1 }]}>{safeRating.toFixed(1)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  value: {
    color: '#076F32',
    fontWeight: '800',
  },
});

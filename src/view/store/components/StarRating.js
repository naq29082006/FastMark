import { StyleSheet, Text, View } from 'react-native';

export default function StarRating({ rating, size = 14, showValue = false }) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const fullStars = Math.floor(safeRating);
  const hasHalf = safeRating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <View style={styles.row}>
      <Text style={[styles.stars, { fontSize: size }]}>
        {'★'.repeat(fullStars)}
        {hasHalf ? '½' : ''}
        {'☆'.repeat(emptyStars)}
      </Text>
      {showValue && (
        <Text style={[styles.value, { fontSize: size - 1 }]}>
          {safeRating.toFixed(1)}
        </Text>
      )}
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
    color: '#f59e0b',
    letterSpacing: 1,
  },
  value: {
    color: '#0f766e',
    fontWeight: '800',
  },
});

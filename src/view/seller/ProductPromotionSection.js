import { Switch, Text, View, StyleSheet } from 'react-native';

import KeyboardAwareTextInput from '../shared/components/KeyboardAwareTextInput';

import { getProductPromoPriceLabels } from '../../core/utils/productFormat';
import DatePickerField from '../shared/components/DatePickerField';

/**
 * Section khuyến mãi sản phẩm — nhập % giảm giá.
 * Preview: giá gốc min-max (gạch) + %; dòng dưới giá sau giảm min-max.
 */
export default function ProductPromotionSection({
  enabled,
  basePrice,
  baseMaxPrice,
  discountPercent,
  startDate,
  endDate,
  onChange,
  disabled = false,
}) {
  const percent = Number(discountPercent) || 0;
  const originalMin = Number(basePrice) || 0;
  const originalMax = Number(baseMaxPrice) > 0 ? Number(baseMaxPrice) : originalMin;
  const { originalLabel, saleLabel } = getProductPromoPriceLabels({
    minPrice: originalMin,
    maxPrice: originalMax,
    discountPercent: percent,
    isPromotion: true,
  });
  const canPreview = percent >= 1 && percent <= 99 && originalMin > 0;

  function patch(partial) {
    onChange?.(partial);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Khuyến mãi</Text>
        <Switch
          value={Boolean(enabled)}
          onValueChange={(value) => patch({ enabled: value })}
          disabled={disabled}
          trackColor={{ false: '#cbd5e1', true: '#86efac' }}
          thumbColor={enabled ? '#076F32' : '#f8fafc'}
          accessibilityRole="switch"
        />
      </View>
      <Text style={styles.hint}>Bật và nhập % giảm giá hiển thị trên app người mua.</Text>

      {enabled ? (
        <View style={styles.fields}>
          <Text style={styles.label}>Phần trăm giảm giá (%)</Text>
          <KeyboardAwareTextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(discountPercent ?? '')}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^\d]/g, '');
              const capped = cleaned === '' ? '' : String(Math.min(99, Number(cleaned) || 0));
              patch({ discountPercent: capped });
            }}
            placeholder="VD: 20"
            placeholderTextColor="#94a3b8"
            editable={!disabled}
            maxLength={2}
          />

          {canPreview ? (
            <View style={styles.previewBox}>
              <View style={styles.previewRow}>
                <Text style={styles.originalPrice}>{originalLabel}</Text>
                <Text style={styles.discountBadge}>−{percent}%</Text>
              </View>
              <Text style={styles.salePrice}>{saleLabel}</Text>
            </View>
          ) : (
            <Text style={styles.warn}>
              {originalMin > 0
                ? 'Nhập mức giảm từ 1% đến 99%.'
                : 'Thêm biến thể có giá để xem giá sau giảm.'}
            </Text>
          )}

          <View style={styles.dateRow}>
            <DatePickerField
              label="Ngày bắt đầu"
              value={String(startDate || '')}
              onChange={(next) => patch({ startDate: next })}
              valueFormat="iso"
              disabled={disabled}
            />
            <DatePickerField
              label="Ngày kết thúc"
              value={String(endDate || '')}
              onChange={(next) => patch({ endDate: next })}
              valueFormat="iso"
              minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
              disabled={disabled}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function buildPromotionPayload(promo) {
  if (!promo?.enabled) {
    return {
      isPromotion: false,
      discountPercent: 0,
    };
  }
  return {
    isPromotion: true,
    discountPercent: Number(promo.discountPercent) || 0,
    promotionStartDate: promo.startDate || undefined,
    promotionEndDate: promo.endDate || undefined,
  };
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    marginBottom: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  hint: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
  },
  fields: {
    marginTop: 12,
    gap: 4,
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  dateRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  previewBox: {
    marginTop: 8,
    gap: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  originalPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  salePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#076F32',
  },
  warn: {
    marginTop: 8,
    color: '#b45309',
    fontSize: 12,
    fontWeight: '600',
  },
});

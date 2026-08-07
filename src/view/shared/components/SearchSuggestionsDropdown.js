import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { groupSuggestionsByType } from '../../../core/utils/searchSuggestions';

const TYPE_ICON_BOX = 40;

function formatUsername(value) {
  const text = String(value || '').trim().replace(/^@+/, '');
  return text ? `@${text}` : '';
}

function SuggestionDivider() {
  return <View style={styles.divider} />;
}

function SuggestionTypeIcon({ type }) {
  const config =
    type === 'shop'
      ? { icon: 'storefront-outline', bg: '#ecfdf5', color: '#076F32' }
      : type === 'user'
        ? { icon: 'person-outline', bg: '#f1f5f9', color: '#475569' }
        : { icon: 'cube-outline', bg: '#ecfdf5', color: '#076F32' };

  return (
    <View style={[styles.typeIcon, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon} size={22} color={config.color} />
    </View>
  );
}

function ProductSuggestionRow({ item, onPress }) {
  const name = item.data?.name || item.data?.productName || 'Sản phẩm';
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress?.(item)}
    >
      <SuggestionTypeIcon type="product" />
      <Text style={styles.primaryTextSingle} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

function ShopSuggestionRow({ item, onPress }) {
  const name = item.data?.shop_name || item.data?.name || 'Gian hàng';
  const username = formatUsername(item.data?.shop_username || item.data?.shopUsername);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress?.(item)}
    >
      <SuggestionTypeIcon type="shop" />
      <View style={styles.textBlock}>
        <Text style={styles.primaryText} numberOfLines={1}>
          {name}
        </Text>
        {username ? (
          <Text style={styles.secondaryText} numberOfLines={1}>
            {username}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function UserSuggestionRow({ item, onPress }) {
  const name =
    item.data?.fullName || item.data?.displayName || item.data?.userName || 'Người dùng';
  const username = formatUsername(item.data?.userName || item.data?.username);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress?.(item)}
    >
      <SuggestionTypeIcon type="user" />
      <View style={styles.textBlock}>
        <Text style={styles.primaryText} numberOfLines={1}>
          {name}
        </Text>
        {username ? (
          <Text style={styles.secondaryText} numberOfLines={1}>
            {username}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SearchSuggestionsDropdown({
  items = [],
  loading = false,
  visible = true,
  onPressItem,
  emptyHint = 'Không có gợi ý phù hợp.',
  embedded = false,
}) {
  if (!visible) {
    return null;
  }

  const { products, shops, users } = groupSuggestionsByType(items);
  const hasAny = products.length + shops.length + users.length > 0;

  return (
    <View style={[styles.panel, embedded && styles.panelEmbedded]}>
      {loading && !hasAny ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#076F32" />
          <Text style={styles.loadingText}>Đang gợi ý…</Text>
        </View>
      ) : null}

      {!loading && !hasAny ? (
        <Text style={styles.emptyText}>{emptyHint}</Text>
      ) : null}

      {products.map((item) => (
        <ProductSuggestionRow key={item.id} item={item} onPress={onPressItem} />
      ))}

      {products.length > 0 && (shops.length > 0 || users.length > 0) ? <SuggestionDivider /> : null}

      {shops.map((item) => (
        <ShopSuggestionRow key={item.id} item={item} onPress={onPressItem} />
      ))}

      {shops.length > 0 && users.length > 0 ? <SuggestionDivider /> : null}

      {users.map((item) => (
        <UserSuggestionRow key={item.id} item={item} onPress={onPressItem} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  panelEmbedded: {
    marginTop: 0,
    borderWidth: 0,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 56,
  },
  rowPressed: {
    backgroundColor: '#f8fafc',
  },
  typeIcon: {
    width: TYPE_ICON_BOX,
    height: TYPE_ICON_BOX,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 1,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 20,
    includeFontPadding: false,
  },
  primaryTextSingle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 20,
    includeFontPadding: false,
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 16,
    includeFontPadding: false,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyText: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
});

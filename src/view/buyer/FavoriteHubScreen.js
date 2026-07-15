import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import FavoriteProductsScreen from './FavoriteProductsScreen';
import FavoriteShopsScreen from './FavoriteShopsScreen';

const TABS = [
  { key: 'products', label: 'Sản phẩm' },
  { key: 'shops', label: 'Gian hàng' },
];

export default function FavoriteHubScreen({ onOpenProduct, onOpenStore }) {
  const [activeTab, setActiveTab] = useState('products');

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {activeTab === 'products' ? (
          <FavoriteProductsScreen onOpenProduct={onOpenProduct} />
        ) : (
          <FavoriteShopsScreen onOpenStore={onOpenStore} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f8f7',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0f766e',
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
});

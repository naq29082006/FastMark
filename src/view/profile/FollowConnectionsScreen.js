import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import CircularBackButton from '../shared/components/CircularBackButton';

const TABS = [
  { key: 'following', label: 'Đang theo dõi' },
  { key: 'followers', label: 'Người theo dõi' },
];

export default function FollowConnectionsScreen({ onBack }) {
  const [activeTab, setActiveTab] = useState('following');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <CircularBackButton onPress={onBack} variant="surface" />
        <Text style={styles.title}>Kết nối</Text>
        <View style={styles.headerSpacer} />
      </View>

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

      <View style={styles.emptyBox}>
        <Text style={styles.emptyIcon}>{activeTab === 'following' ? '👥' : '❤️'}</Text>
        <Text style={styles.emptyTitle}>
          {activeTab === 'following' ? 'Chưa theo dõi ai' : 'Chưa có người theo dõi'}
        </Text>
        <Text style={styles.emptySubtitle}>
          Tính năng theo dõi sẽ sớm có mặt. Hiện tại bạn chỉ xem được danh sách của chính mình.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 40,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
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
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
  },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import MapScreen from '../map/MapScreen';
import ProfilePanel from './ProfilePanel';

const TABS = [
  { key: 'map', label: 'Bản đồ', icon: '🗺️' },
  { key: 'profile', label: 'Hồ sơ', icon: '👤' },
];

export default function AuthenticatedHome() {
  const [activeTab, setActiveTab] = useState('map');
  const [mapFocusRequest, setMapFocusRequest] = useState(null);

  function handleOpenStoreFromProfile(storeId) {
    setMapFocusRequest({
      storeId: String(storeId),
      at: Date.now(),
    });
    setActiveTab('map');
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {activeTab === 'map' ? (
          <MapScreen focusStoreRequest={mapFocusRequest} />
        ) : (
          <ProfilePanel onOpenStore={handleOpenStoreFromProfile} />
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && styles.tabItemPressed,
              ]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 24,
    position: 'relative',
  },
  tabItemPressed: {
    opacity: 0.7,
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.45,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabLabelActive: {
    color: '#0f766e',
    fontWeight: '900',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 3,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#0f766e',
  },
});

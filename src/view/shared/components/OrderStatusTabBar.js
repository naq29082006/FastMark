import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function TabItems({ tabs, activeTab, onChangeTab, equalWidth }) {
  return tabs.map((tab) => {
    const isActive = activeTab === tab.key;
    return (
      <Pressable
        key={tab.key}
        onPress={() => onChangeTab(tab.key)}
        style={[styles.tabItem, equalWidth && styles.tabItemEqual]}
      >
        <Text
          style={[styles.tabText, isActive && styles.tabTextActive]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
        <View style={[styles.tabIndicator, !isActive && styles.tabIndicatorHidden]} />
      </Pressable>
    );
  });
}

export default function OrderStatusTabBar({
  tabs,
  activeTab,
  onChangeTab,
  equalWidth = false,
  trailingSlot = null,
}) {
  const tabItems = (
    <TabItems tabs={tabs} activeTab={activeTab} onChangeTab={onChangeTab} equalWidth={equalWidth} />
  );

  const tabBody = equalWidth ? (
    <View style={styles.tabRowEqual}>{tabItems}</View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={styles.tabScrollContent}
    >
      {tabItems}
    </ScrollView>
  );

  if (trailingSlot) {
    return (
      <View style={[styles.tabRow, styles.tabRowWithTrailing]}>
        <View style={styles.tabMain}>{tabBody}</View>
        <View style={styles.tabTrailing}>{trailingSlot}</View>
      </View>
    );
  }

  return <View style={styles.tabRow}>{tabBody}</View>;
}

const styles = StyleSheet.create({
  tabRow: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabRowWithTrailing: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  tabRowEqual: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
  },
  tabMain: {
    flex: 1,
    minWidth: 0,
  },
  tabTrailing: {
    flexShrink: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingRight: 8,
    paddingBottom: 4,
  },
  tabItem: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  tabItemEqual: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#076F32',
    fontWeight: '800',
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: '#076F32',
  },
  tabIndicatorHidden: {
    backgroundColor: 'transparent',
  },
});

import { StyleSheet, View } from 'react-native';

import OrderStatusTabBar from './OrderStatusTabBar';

/** Tab Gói đang có / Mua gói — full bleed, nội dung nằm chung khối trắng bên dưới. */
export default function PlanTabPanel({ tabs, activeTab, onChangeTab, children }) {
  return (
    <View style={styles.panel}>
      <OrderStatusTabBar
        equalWidth
        tabs={tabs}
        activeTab={activeTab}
        onChangeTab={onChangeTab}
      />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: -16,
    marginTop: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    flex: 1,
    minHeight: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
});

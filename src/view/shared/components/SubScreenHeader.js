import { StyleSheet, Text, View } from 'react-native';

import { useScreenInsets } from '../../../hooks/useScreenInsets';
import CircularBackButton from './CircularBackButton';

export const APP_HEADER_BACK_SIZE = 36;
export const APP_HEADER_TITLE_SIZE = 17;
/** Tiêu đề tab gốc (không nút back) — đồng bộ với HomeScreen “Sản phẩm”. */
export const ROOT_TAB_SCREEN_TITLE_SIZE = 20;

export const APP_HEADER_ICON_BUTTON_STYLE = {
  width: APP_HEADER_BACK_SIZE,
  height: APP_HEADER_BACK_SIZE,
  borderRadius: APP_HEADER_BACK_SIZE / 2,
  borderWidth: 1,
  borderColor: '#e2e8f0',
  backgroundColor: '#ffffff',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * Header chuẩn toàn app: nền trắng, nút back, title đen căn trái.
 */
export default function SubScreenHeader({ title, onBack, rightSlot = null, centerSlot = null }) {
  const insets = useScreenInsets();
  const showBack = typeof onBack === 'function';

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
      {showBack ? (
        <CircularBackButton
          onPress={onBack}
          variant="plain"
          size={APP_HEADER_BACK_SIZE}
          style={styles.backButton}
        />
      ) : null}
      {centerSlot ? (
        <View style={styles.centerSlot}>{centerSlot}</View>
      ) : (
        <Text
          style={[
            styles.title,
            !showBack && styles.titleRootTab,
            !showBack && styles.titleFlush,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      )}
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: APP_HEADER_TITLE_SIZE,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'left',
  },
  titleFlush: {
    paddingLeft: 0,
  },
  titleRootTab: {
    fontSize: ROOT_TAB_SCREEN_TITLE_SIZE,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.1,
  },
  centerSlot: {
    flex: 1,
    minWidth: 0,
  },
  rightSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_GAP = 8;
const TAB_BAR_EXTRA = 8;

export function useScreenInsets() {
  const insets = useSafeAreaInsets();

  return {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
    headerPaddingTop: insets.top + HEADER_GAP,
    contentPaddingTop: HEADER_GAP,
    tabBarPaddingBottom: Math.max(insets.bottom, TAB_BAR_EXTRA),
    floatingTop: insets.top + HEADER_GAP,
    bottomSpacing: Math.max(insets.bottom, 12),
  };
}

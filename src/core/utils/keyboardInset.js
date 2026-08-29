import { Dimensions, Keyboard, Platform } from 'react-native';

/** Khoảng cách giữa nội dung và bàn phím (px). */
export const KEYBOARD_COMPOSER_GAP = 12;

/** Window co ít nhất bấy nhiêu px → adjustResize đang hoạt động. */
const ANDROID_RESIZE_THRESHOLD = 80;

export const KEYBOARD_LAYOUT_HIDDEN = {
  inset: 0,
  composerBottom: 0,
  isWindowResized: false,
  isKeyboardVisible: false,
};

/**
 * @returns {{ inset: number, composerBottom: number, isWindowResized: boolean }}
 */
export function resolveKeyboardLayout(
  event,
  bottomSafeInset = 0,
  baselineWindowHeight = null
) {
  const height = Number(event?.endCoordinates?.height) || 0;
  const screenY = Number(event?.endCoordinates?.screenY) || 0;
  const windowHeight = Dimensions.get('window').height;
  const screenHeight = Dimensions.get('screen').height;
  const metricsHeight = Number(Keyboard.metrics?.()?.height) || 0;
  const reportedHeight = Math.max(height, metricsHeight);

  if (reportedHeight <= 0) {
    return { inset: 0, composerBottom: 0, isWindowResized: false };
  }

  if (Platform.OS === 'ios') {
    const inset = Math.max(0, reportedHeight - bottomSafeInset) + KEYBOARD_COMPOSER_GAP;
    return { inset, composerBottom: inset, isWindowResized: false };
  }

  const baseline = baselineWindowHeight ?? windowHeight;
  const windowShrink = baseline - windowHeight;

  const keyboardTopGap =
    screenY > 0 ? windowHeight - screenY : Number.POSITIVE_INFINITY;
  const isOverlayKeyboard =
    windowShrink < ANDROID_RESIZE_THRESHOLD &&
    screenY > 0 &&
    keyboardTopGap > 48;

  // Mặc định coi là adjustResize (composerBottom = 0) trừ khi chắc chắn overlay.
  if (!isOverlayKeyboard) {
    return {
      inset: KEYBOARD_COMPOSER_GAP,
      composerBottom: 0,
      isWindowResized: true,
    };
  }

  const overlapFromWindow = screenY > 0 ? Math.max(0, windowHeight - screenY) : 0;
  const overlapFromScreen = screenY > 0 ? Math.max(0, screenHeight - screenY) : 0;
  const overlap = Math.max(reportedHeight, overlapFromWindow, overlapFromScreen);

  if (overlap <= 0) {
    return { inset: 0, composerBottom: 0, isWindowResized: false };
  }

  const inset = overlap + KEYBOARD_COMPOSER_GAP;
  return { inset, composerBottom: inset, isWindowResized: false };
}

export function subscribeKeyboardInsets({
  onChange,
  bottomSafeInset = 0,
  shouldSuppressHide,
}) {
  let keyboardOpen = false;
  let baselineWindowHeight = Dimensions.get('window').height;
  let hideTimer = null;

  const emitLayout = (event) => {
    if (!keyboardOpen) {
      return;
    }

    const layout = resolveKeyboardLayout(event, bottomSafeInset, baselineWindowHeight);
    onChange({
      ...layout,
      isKeyboardVisible: true,
    });
  };

  const updateInset = (event) => {
    emitLayout(event);

    if (Platform.OS === 'android') {
      requestAnimationFrame(() => emitLayout(event));
    }
  };

  const showInset = (event) => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!keyboardOpen) {
      const currentHeight = Dimensions.get('window').height;
      baselineWindowHeight = Math.max(baselineWindowHeight, currentHeight);
    }
    keyboardOpen = true;
    updateInset(event);
  };

  const clearInset = () => {
    if (shouldSuppressHide?.()) {
      return;
    }

    const finishHide = () => {
      keyboardOpen = false;
      baselineWindowHeight = Dimensions.get('window').height;
      onChange(KEYBOARD_LAYOUT_HIDDEN);
    };

    if (Platform.OS === 'android') {
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
      hideTimer = setTimeout(() => {
        hideTimer = null;
        finishHide();
      }, 120);
      return;
    }

    finishHide();
  };

  const subscriptions = [];

  if (Platform.OS === 'ios') {
    subscriptions.push(Keyboard.addListener('keyboardWillShow', showInset));
    subscriptions.push(Keyboard.addListener('keyboardWillHide', clearInset));
  } else {
    subscriptions.push(Keyboard.addListener('keyboardDidShow', showInset));
    subscriptions.push(Keyboard.addListener('keyboardDidHide', clearInset));
    subscriptions.push(
      Keyboard.addListener('keyboardDidChangeFrame', (event) => {
        if (!keyboardOpen) {
          return;
        }
        updateInset(event);
      })
    );
  }

  return () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
    subscriptions.forEach((subscription) => subscription.remove());
  };
}

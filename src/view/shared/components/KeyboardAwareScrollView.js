import { createContext, forwardRef, useCallback, useContext, useImperativeHandle, useRef } from 'react';
import { Platform, ScrollView } from 'react-native';

import { scrollInputIntoView } from '../../../core/utils/scrollInputIntoView';
import { useKeyboardInset } from '../../../hooks/useKeyboardInset';
import { FORM_SHEET_SCROLL_PADDING_BOTTOM } from './formSheetLayout';

const KeyboardScrollContext = createContext(null);

export function useKeyboardScroll() {
  return useContext(KeyboardScrollContext);
}

/**
 * ScrollView tự thêm padding khi bàn phím mở (Android overlay + iOS).
 */
const KeyboardAwareScrollView = forwardRef(function KeyboardAwareScrollView(
  {
    children,
    style,
    contentContainerStyle,
    extraBottomInset = 0,
    nestedScrollPadding = true,
    inputObstructionBottom = 0,
    suppressHideRef,
    keyboardDismissMode,
    onScroll,
    ...rest
  },
  ref
) {
  const scrollRef = useRef(null);
  const scrollYRef = useRef(0);
  const { keyboardInset, isKeyboardVisible, getScrollPaddingBottom } = useKeyboardInset({
    suppressHideRef,
  });

  useImperativeHandle(ref, () => scrollRef.current);

  const scrollToInput = useCallback(
    (inputRef, gap = 24) => {
      scrollInputIntoView(scrollRef, inputRef, {
        keyboardInset,
        scrollY: scrollYRef.current,
        getScrollY: () => scrollYRef.current,
        obstructionBottom: inputObstructionBottom,
        gap,
      });
    },
    [inputObstructionBottom, keyboardInset]
  );

  const paddingBottom =
    getScrollPaddingBottom(extraBottomInset, {
      nestedWhenClosed: nestedScrollPadding,
    }) + (nestedScrollPadding ? 0 : FORM_SHEET_SCROLL_PADDING_BOTTOM);

  return (
    <KeyboardScrollContext.Provider value={{ scrollRef, scrollToInput, keyboardInset, isKeyboardVisible }}>
      <ScrollView
        ref={scrollRef}
        style={[{ flex: 1 }, style]}
        contentContainerStyle={[contentContainerStyle, { paddingBottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          keyboardDismissMode ??
          (nestedScrollPadding === false
            ? 'none'
            : Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag')
        }
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
        scrollEventThrottle={16}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardScrollContext.Provider>
  );
});

export default KeyboardAwareScrollView;

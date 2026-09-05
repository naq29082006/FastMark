import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { useKeyboardScroll } from './KeyboardAwareScrollView';

/**
 * TextInput tự cuộn vào vùng nhìn thấy khi nằm trong KeyboardAwareScrollView.
 */
const KeyboardAwareTextInput = forwardRef(function KeyboardAwareTextInput(
  { onFocus, onBlur, scrollGap = 24, ...props },
  ref
) {
  const inputRef = useRef(null);
  const keyboardScroll = useKeyboardScroll();
  const [focused, setFocused] = useState(false);

  useImperativeHandle(ref, () => inputRef.current);

  useEffect(() => {
    if (!focused) {
      return;
    }
    if (!keyboardScroll?.scrollToInput) {
      return;
    }
    keyboardScroll.scrollToInput(inputRef, scrollGap);
  }, [focused, keyboardScroll?.keyboardInset, scrollGap]);

  return (
    <TextInput
      {...props}
      ref={inputRef}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
        keyboardScroll?.scrollToInput?.(inputRef, scrollGap);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
});

export default KeyboardAwareTextInput;

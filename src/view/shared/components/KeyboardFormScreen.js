import { StyleSheet, View } from 'react-native';

import SubScreenHeader from './SubScreenHeader';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import { FormSheetKeyboardAvoid } from './formSheetLayout';

/**
 * Màn form chuẩn: header + scroll có xử lý bàn phím; footer (nếu có) nằm trong scroll.
 */
export default function KeyboardFormScreen({
  title,
  onBack,
  children,
  headerBelow,
  footer,
  contentContainerStyle,
  nestedScrollPadding = true,
  backgroundColor = '#f1f5f9',
  scroll = true,
  refreshControl,
  suppressHideRef,
}) {
  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <SubScreenHeader title={title} onBack={onBack} />
      {headerBelow}
      <FormSheetKeyboardAvoid style={styles.avoid}>
        {scroll ? (
          <KeyboardAwareScrollView
            style={styles.scroll}
            extraBottomInset={0}
            nestedScrollPadding={nestedScrollPadding}
            contentContainerStyle={[styles.bodyContent, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            suppressHideRef={suppressHideRef}
          >
            {children}
            {footer}
          </KeyboardAwareScrollView>
        ) : (
          <View style={[styles.bodyFlex, styles.bodyContent]}>
            {children}
            {footer}
          </View>
        )}
      </FormSheetKeyboardAvoid>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  avoid: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bodyFlex: {
    flex: 1,
    minHeight: 0,
  },
});

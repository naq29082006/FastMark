import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useKeyboardInset } from '../../../hooks/useKeyboardInset';
import { useScreenInsets } from '../../../hooks/useScreenInsets';
import { BOTTOM_SHEET_BORDER } from './bottomSheetChrome';

/** Padding cuối nội dung cuộn trong modal/form sheet. */
export const FORM_SHEET_SCROLL_PADDING_BOTTOM = 28;

/** Tỷ lệ chiều cao bottom sheet form — cố định 3/4 màn hình. */
export const FORM_SHEET_HEIGHT_RATIO = 0.75;

/** Alias tương thích — sheet dùng `getFormSheetHeight()` thay vì maxHeight %. */
export const FORM_SHEET_MAX_HEIGHT = '75%';

export function getFormSheetHeight(ratio = FORM_SHEET_HEIGHT_RATIO) {
  return Math.round(Dimensions.get('window').height * ratio);
}

/** ScrollView / KeyboardAwareScrollView bên trong FormSheetShell — chiếm phần còn lại của sheet. */
export const FORM_SHEET_SCROLL_STYLE = {
  flex: 1,
  minHeight: 0,
};

/**
 * Vùng sheet trắng cố định ~75% màn hình.
 * Không bọc KeyboardAvoidingView / không đổi cấu trúc khi bàn phím mở — tránh mất focus input.
 * Cuộn + padding bàn phím do KeyboardAwareScrollView bên trong xử lý.
 */
export function FormSheetShell({ style, panelStyle, heightRatio = FORM_SHEET_HEIGHT_RATIO, children }) {
  const insets = useScreenInsets();
  const safeBottom = Math.max(insets.bottomSpacing, 8);
  const sheetHeightRef = useRef(null);
  if (sheetHeightRef.current == null) {
    sheetHeightRef.current = getFormSheetHeight(heightRatio);
  }
  const sheetHeight = sheetHeightRef.current;

  return (
    <View style={[shellStyles.outer, style]}>
      <View
        style={[
          shellStyles.panel,
          { height: sheetHeight, paddingBottom: safeBottom },
          panelStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Vùng tối phía sau sheet — bấm để đóng.
 */
export function FormSheetBackdrop({ onClose }) {
  if (typeof onClose !== 'function') {
    return null;
  }
  return (
    <Pressable
      style={StyleSheet.absoluteFillObject}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Đóng"
    />
  );
}

/**
 * Tiêu đề sheet + nút đóng (×).
 */
export function FormSheetHeader({ title, onClose, disabled = false, rightSlot = null }) {
  return (
    <View style={headerStyles.row}>
      <Text style={headerStyles.title} numberOfLines={2}>
        {title}
      </Text>
      <View style={headerStyles.trailing}>
        {rightSlot}
        {typeof onClose === 'function' ? (
          <Pressable
            onPress={onClose}
            hitSlop={8}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            style={headerStyles.closeBtn}
          >
            <Ionicons name="close" size={22} color="#64748b" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Hàng nút cuối form — nằm trong ScrollView, không absolute.
 */
export function FormSheetActions({ children, style }) {
  return (
    <View style={[formSheetActionsStyles.root, formSheetActionsStyles.rootPad, style]}>
      {children}
    </View>
  );
}

/**
 * Bọc màn hình form full-screen — tránh nhảy layout khi bàn phím mở (không dùng cho bottom sheet).
 */
export function FormSheetKeyboardAvoid({ style, children, maxHeight }) {
  const { composerBottom, isWindowResized } = useKeyboardInset();

  return (
    <KeyboardAvoidingView
      style={[
        formSheetActionsStyles.avoid,
        maxHeight != null && { maxHeight },
        Platform.OS === 'android' &&
          composerBottom > 0 &&
          !isWindowResized && { marginBottom: composerBottom },
        style,
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const shellStyles = StyleSheet.create({
  outer: {
    width: '100%',
  },
  panel: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...BOTTOM_SHEET_BORDER,
    flexDirection: 'column',
    overflow: 'hidden',
  },
});

const formSheetActionsStyles = StyleSheet.create({
  avoid: {
    width: '100%',
  },
  root: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingTop: 4,
  },
  rootPad: {
    paddingBottom: 12,
  },
});

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
});

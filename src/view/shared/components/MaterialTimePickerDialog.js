import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { formatTimeString } from '../../../core/utils/timeFormat';
import ScrollWheelTimePicker from './ScrollWheelTimePicker';

export default function MaterialTimePickerDialog({
  visible,
  title,
  subtitle,
  value,
  onChange,
  onCancel,
  onConfirm,
  minuteInterval = 1,
  confirmLabel = 'OK',
  useNativePicker = Platform.OS === 'ios',
}) {
  const [pickerValue, setPickerValue] = useState(value);
  const [headerTime, setHeaderTime] = useState(() => formatTimeString(value));

  useEffect(() => {
    if (!visible) {
      return;
    }
    setPickerValue(value);
    setHeaderTime(formatTimeString(value));
  }, [visible, value]);

  const handleChange = useCallback(
    (nextValue) => {
      setPickerValue(nextValue);
      onChange(nextValue);
      setHeaderTime(formatTimeString(nextValue));
    },
    [onChange]
  );

  function handleNativeChange(_event, selectedDate) {
    if (selectedDate) {
      handleChange(selectedDate);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.headerSubtitle}>{subtitle || title || 'Chọn giờ'}</Text>
            <Text style={styles.headerValue}>{headerTime}</Text>
          </View>

          {visible && useNativePicker ? (
            <DateTimePicker
              value={pickerValue}
              mode="time"
              is24Hour
              display="spinner"
              minuteInterval={minuteInterval}
              onChange={handleNativeChange}
              style={styles.nativePicker}
            />
          ) : null}

          {visible && !useNativePicker ? (
            <ScrollWheelTimePicker
              value={pickerValue}
              onChange={handleChange}
              minuteInterval={minuteInterval}
              variant="material"
            />
          ) : null}

          <View style={styles.footer}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
              hitSlop={8}
            >
              <Text style={styles.footerBtnText}>HỦY</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
              hitSlop={8}
            >
              <Text style={styles.footerBtnText}>{confirmLabel.toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  dialog: {
    width: '100%',
    maxWidth: 348,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  header: {
    backgroundColor: '#076F32',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 22,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.82)',
    marginBottom: 8,
  },
  headerValue: {
    fontSize: 36,
    fontWeight: '500',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  nativePicker: {
    alignSelf: 'center',
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 0,
  },
  footerBtnPressed: {
    opacity: 0.72,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#076F32',
    letterSpacing: 0.8,
  },
});

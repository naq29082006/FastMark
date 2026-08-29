import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { formatTimeString, parseTimeString, snapTimeToMinuteInterval } from '../../../core/utils/timeFormat';
import { usePickerDismissGuard } from './pickerDismissGuard';
import MaterialTimePickerDialog from './MaterialTimePickerDialog';

export default function TimePickerField({
  label,
  value,
  onChange,
  placeholder = '08:00',
  compact = false,
  minuteInterval = 1,
  style,
  confirmLabel = 'OK',
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseTimeString(value, placeholder));
  const draftRef = useRef(draftDate);
  const { guardOpen, closeWithGuard } = usePickerDismissGuard();
  const hasValue = Boolean(String(value || '').trim());
  const displayValue = hasValue ? String(value).trim() : placeholder;
  const useCustomWheel = minuteInterval > 1;
  const pickerDate = useMemo(
    () => snapTimeToMinuteInterval(parseTimeString(value, placeholder), minuteInterval),
    [minuteInterval, placeholder, value]
  );

  useEffect(() => {
    if (!showPicker) {
      const next = snapTimeToMinuteInterval(parseTimeString(value, placeholder), minuteInterval);
      draftRef.current = next;
      setDraftDate(next);
    }
  }, [minuteInterval, placeholder, showPicker, value]);

  function openPicker() {
    guardOpen(() => {
      const next = snapTimeToMinuteInterval(parseTimeString(value, placeholder), minuteInterval);
      draftRef.current = next;
      setDraftDate(next);
      setShowPicker(true);
    });
  }

  function closePicker() {
    closeWithGuard(() => setShowPicker(false));
  }

  function confirmPicker() {
    const snapped = snapTimeToMinuteInterval(draftRef.current, minuteInterval);
    onChange?.(formatTimeString(snapped));
    closePicker();
  }

  function handlePickerChange(nextDate) {
    draftRef.current = nextDate;
    setDraftDate(nextDate);
  }

  function handleAndroidNativeChange(event, selectedDate) {
    closePicker();
    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }
    const snapped = snapTimeToMinuteInterval(selectedDate, minuteInterval);
    onChange?.(formatTimeString(snapped));
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.field, compact && styles.fieldCompact, style]}>
        {label ? <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          style={[styles.webInput, compact && styles.webInputCompact]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.field, compact && styles.fieldCompact, style]}>
      {label ? <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text> : null}
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          styles.timeButton,
          compact && styles.timeButtonCompact,
          pressed && styles.timeButtonPressed,
        ]}
      >
        <Text
          style={[
            styles.timeValue,
            compact && styles.timeValueCompact,
            !hasValue && styles.timeValuePlaceholder,
          ]}
        >
          {displayValue}
        </Text>
        <View style={[styles.timeButtonIconWrap, compact && styles.timeButtonIconWrapCompact]}>
          <Ionicons name="time-outline" size={20} color="#076F32" />
        </View>
      </Pressable>

      {Platform.OS === 'android' && showPicker && !useCustomWheel ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour
          display="spinner"
          onChange={handleAndroidNativeChange}
        />
      ) : null}

      {Platform.OS === 'ios' || useCustomWheel ? (
        <MaterialTimePickerDialog
          visible={showPicker}
          title={label || 'Chọn giờ'}
          subtitle={label || 'Chọn giờ'}
          value={draftDate}
          onChange={handlePickerChange}
          onCancel={closePicker}
          onConfirm={confirmPicker}
          minuteInterval={minuteInterval}
          confirmLabel={confirmLabel}
          useNativePicker={!useCustomWheel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  fieldCompact: {
    flex: 1,
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  labelCompact: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  timeButton: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeButtonCompact: {
    minHeight: 48,
    borderWidth: 1,
  },
  timeButtonPressed: {
    opacity: 0.85,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  timeValueCompact: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
  },
  timeValuePlaceholder: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  timeButtonIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonIconWrapCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  webInput: {
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  webInputCompact: {
    minHeight: 48,
    borderWidth: 1,
  },
});

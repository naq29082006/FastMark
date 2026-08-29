import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;
const PADDING_ITEMS = Math.floor(VISIBLE_COUNT / 2);
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
const LOOP_SETS = 3;
const MIDDLE_SET = 1;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildMinuteOptions(minuteInterval) {
  const step = Math.max(1, Math.min(30, Number(minuteInterval) || 1));
  const options = [];
  for (let minute = 0; minute < 60; minute += step) {
    options.push(minute);
  }
  return options;
}

function snapMinute(minute, minuteOptions) {
  if (!minuteOptions.length) {
    return 0;
  }
  return minuteOptions.reduce((best, candidate) =>
    Math.abs(candidate - minute) < Math.abs(best - minute) ? candidate : best
  );
}

const WheelRow = memo(function WheelRow({ label }) {
  return (
    <View style={styles.wheelItem}>
      <Text style={styles.wheelItemText}>{label}</Text>
    </View>
  );
});

const LoopWheelColumn = memo(function LoopWheelColumn({
  items,
  selectedValue,
  onValueChange,
  formatItem = (value) => String(value),
}) {
  const scrollRef = useRef(null);
  const isDraggingRef = useRef(false);
  const selectedRef = useRef(null);
  const onValueChangeRef = useRef(onValueChange);
  const itemsRef = useRef(items);
  const itemCount = items.length;

  onValueChangeRef.current = onValueChange;
  itemsRef.current = items;

  const loopLabels = useMemo(() => {
    const rows = [];
    for (let set = 0; set < LOOP_SETS; set += 1) {
      for (let index = 0; index < itemCount; index += 1) {
        rows.push(formatItem(items[index]));
      }
    }
    return rows;
  }, [formatItem, itemCount, items]);

  const scrollYForValue = useCallback((value) => {
    const index = Math.max(0, itemsRef.current.indexOf(value));
    return (MIDDLE_SET * itemCount + index) * ITEM_HEIGHT;
  }, [itemCount]);

  const valueFromScrollY = useCallback(
    (offsetY) => {
      const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
      const valueIndex = ((rawIndex % itemCount) + itemCount) % itemCount;
      return itemsRef.current[valueIndex];
    },
    [itemCount]
  );

  const alignToValue = useCallback(
    (value, animated = false) => {
      scrollRef.current?.scrollTo({
        y: scrollYForValue(value),
        animated,
      });
    },
    [scrollYForValue]
  );

  useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }
    if (selectedRef.current === selectedValue) {
      return;
    }
    selectedRef.current = selectedValue;
    alignToValue(selectedValue, false);
  }, [alignToValue, selectedValue]);

  const emitValue = useCallback(
    (offsetY) => {
      const nextValue = valueFromScrollY(offsetY);
      if (nextValue === selectedRef.current) {
        return;
      }
      selectedRef.current = nextValue;
      onValueChangeRef.current(nextValue);
    },
    [valueFromScrollY]
  );

  const finishScroll = useCallback(
    (offsetY) => {
      const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
      const valueIndex = ((rawIndex % itemCount) + itemCount) % itemCount;
      const targetY = (MIDDLE_SET * itemCount + valueIndex) * ITEM_HEIGHT;

      emitValue(offsetY);

      if (rawIndex < itemCount || rawIndex >= (LOOP_SETS - 1) * itemCount) {
        scrollRef.current?.scrollTo({ y: targetY, animated: false });
        return;
      }

      if (Math.abs(offsetY - targetY) > 1) {
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
      }
    },
    [emitValue, itemCount]
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.wheel}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      nestedScrollEnabled
      removeClippedSubviews
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingVertical: PADDING_ITEMS * ITEM_HEIGHT }}
      onScroll={(event) => {
        emitValue(event.nativeEvent.contentOffset.y);
      }}
      onScrollBeginDrag={() => {
        isDraggingRef.current = true;
      }}
      onMomentumScrollBegin={() => {
        isDraggingRef.current = true;
      }}
      onScrollEndDrag={(event) => {
        const velocity = event.nativeEvent.velocity?.y ?? 0;
        if (Math.abs(velocity) < 0.08) {
          isDraggingRef.current = false;
          finishScroll(event.nativeEvent.contentOffset.y);
        }
      }}
      onMomentumScrollEnd={(event) => {
        isDraggingRef.current = false;
        finishScroll(event.nativeEvent.contentOffset.y);
      }}
    >
      {loopLabels.map((label, index) => (
        <WheelRow key={`${label}-${index}`} label={label} />
      ))}
    </ScrollView>
  );
});

export default function ScrollWheelTimePicker({
  value,
  onChange,
  minuteInterval = 1,
  hourLabel = 'Giờ',
  minuteLabel = 'Phút',
  variant = 'table',
}) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minutes = useMemo(() => buildMinuteOptions(minuteInterval), [minuteInterval]);
  const hour = value.getHours();
  const minute = snapMinute(value.getMinutes(), minutes);
  const isMaterial = variant === 'material';

  const hourRef = useRef(hour);
  const minuteRef = useRef(minute);
  hourRef.current = hour;
  minuteRef.current = minute;

  const setHour = useCallback(
    (nextHour) => {
      onChange(new Date(2000, 0, 1, nextHour, minuteRef.current));
    },
    [onChange]
  );

  const setMinute = useCallback(
    (nextMinute) => {
      onChange(new Date(2000, 0, 1, hourRef.current, nextMinute));
    },
    [onChange]
  );

  return (
    <View style={[styles.container, isMaterial && styles.containerMaterial]}>
      <View style={[styles.table, isMaterial && styles.tableMaterial]}>
        <View style={[styles.headerRow, isMaterial && styles.headerRowMaterial]}>
          <Text style={[styles.headerCell, isMaterial && styles.headerCellMaterial]}>{hourLabel}</Text>
          <View style={[styles.headerDivider, isMaterial && styles.headerDividerMaterial]} />
          <Text style={[styles.headerCell, isMaterial && styles.headerCellMaterial]}>{minuteLabel}</Text>
        </View>

        <View style={styles.bodyRow}>
          <View
            style={[
              styles.selectionOverlay,
              isMaterial && styles.selectionOverlayMaterial,
            ]}
            pointerEvents="none"
          />
          <View style={styles.column}>
            <LoopWheelColumn
              items={hours}
              selectedValue={hour}
              onValueChange={setHour}
              formatItem={pad2}
            />
          </View>
          <View style={[styles.columnDivider, isMaterial && styles.columnDividerMaterial]} />
          <View style={styles.column}>
            <LoopWheelColumn
              items={minutes}
              selectedValue={minute}
              onValueChange={setMinute}
              formatItem={pad2}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  containerMaterial: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  tableMaterial: {
    borderWidth: 0,
    borderRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerRowMaterial: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    paddingVertical: 10,
    letterSpacing: 0.3,
  },
  headerCellMaterial: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    paddingVertical: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#e2e8f0',
  },
  headerDividerMaterial: {
    backgroundColor: '#e2e8f0',
  },
  bodyRow: {
    height: WHEEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  column: {
    flex: 1,
    height: WHEEL_HEIGHT,
  },
  columnDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#e2e8f0',
  },
  columnDividerMaterial: {
    backgroundColor: '#e2e8f0',
  },
  selectionOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: PADDING_ITEMS * ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: '#E6F4EC',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    zIndex: 1,
  },
  selectionOverlayMaterial: {
    left: 0,
    right: 0,
    borderRadius: 0,
    backgroundColor: 'rgba(7, 111, 50, 0.06)',
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(7, 111, 50, 0.2)',
  },
  wheel: {
    flex: 1,
    height: WHEEL_HEIGHT,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    fontSize: 21,
    fontWeight: '700',
    color: '#0f172a',
  },
});

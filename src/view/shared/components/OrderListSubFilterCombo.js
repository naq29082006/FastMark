import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OrderListSubFilterCombo({ options = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((option) => option.key === value) || options[0],
    [options, value]
  );

  if (!options.length) {
    return null;
  }

  return (
    <>
      <Pressable
        style={styles.combo}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={selected?.label || 'Chọn bộ lọc'}
      >
        <Text style={styles.comboText} numberOfLines={1}>
          {selected?.label || 'Chọn'}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#64748b" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {options.map((option) => {
              const active = option.key === value;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.menuItem, active ? styles.menuItemActive : null]}
                  onPress={() => {
                    setOpen(false);
                    if (option.key !== value) {
                      onChange?.(option.key);
                    }
                  }}
                >
                  <Text style={[styles.menuItemText, active ? styles.menuItemTextActive : null]}>
                    {option.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={16} color="#076F32" /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  combo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 168,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  comboText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 132,
    paddingRight: 16,
  },
  menu: {
    minWidth: 168,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  menuItemActive: {
    backgroundColor: '#f8fafc',
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  menuItemTextActive: {
    color: '#076F32',
  },
});

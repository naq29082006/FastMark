import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export default function SelectCombobox({
  options = [],
  value,
  onChange,
  placeholder = 'Chọn',
  title = 'Chọn',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => String(option.id) === String(value)) || null,
    [options, value]
  );

  return (
    <>
      <Pressable
        disabled={disabled || options.length === 0}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.combobox,
          disabled && styles.comboboxDisabled,
          pressed && !disabled && styles.comboboxPressed,
        ]}
      >
        <Text style={[styles.comboboxText, !selectedOption && styles.comboboxPlaceholder]}>
          {selectedOption?.label || placeholder}
        </Text>
        <Text style={styles.comboboxArrow}>▼</Text>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{title}</Text>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {options.map((option) => {
                const isActive = String(option.id) === String(value);
                return (
                  <Pressable
                    key={String(option.id)}
                    onPress={() => {
                      onChange(String(option.id));
                      setIsOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalOption,
                      isActive && styles.modalOptionActive,
                      pressed && styles.comboboxPressed,
                    ]}
                  >
                    <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                      {option.label}
                    </Text>
                    {option.description ? (
                      <Text style={styles.modalOptionDescription}>{option.description}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  combobox: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comboboxDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.7,
  },
  comboboxPressed: {
    opacity: 0.85,
  },
  comboboxText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  comboboxPlaceholder: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  comboboxArrow: {
    color: '#64748b',
    fontSize: 12,
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxHeight: '70%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  modalOptionActive: {
    borderColor: '#0d7377',
    backgroundColor: '#e8f3f1',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalOptionTextActive: {
    color: '#0d7377',
  },
  modalOptionDescription: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
});

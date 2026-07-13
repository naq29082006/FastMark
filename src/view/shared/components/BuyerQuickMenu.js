import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BuyerQuickMenu({
  sellerButtonLabel = 'Đăng ký người bán',
  onEditAccount,
  onSellerAction,
  onLogout,
  style,
  buttonStyle,
  dropdownStyle,
  iconColor = '#0f172a',
  activeIconColor = '#ffffff',
}) {
  const [open, setOpen] = useState(false);

  function closeAndRun(action) {
    setOpen(false);
    action?.();
  }

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menu tiện ích"
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          styles.button,
          buttonStyle,
          open && styles.buttonActive,
          pressed && styles.buttonPressed,
        ]}
      >
        <Ionicons
          name={open ? 'close-outline' : 'menu-outline'}
          size={22}
          color={open ? activeIconColor : iconColor}
        />
      </Pressable>

      {open ? (
        <View style={[styles.dropdown, dropdownStyle]}>
          <Pressable onPress={() => closeAndRun(onEditAccount)} style={styles.menuItem}>
            <Text style={styles.menuItemText}>Sửa thông tin tài khoản</Text>
          </Pressable>
          <Pressable onPress={() => closeAndRun(onSellerAction)} style={styles.menuItem}>
            <Text style={styles.menuItemText}>{sellerButtonLabel}</Text>
          </Pressable>
          <Pressable onPress={() => closeAndRun(onLogout)} style={[styles.menuItem, styles.menuItemLast]}>
            <Text style={[styles.menuItemText, styles.menuItemDanger]}>Đăng xuất</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 30,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonActive: {
    backgroundColor: '#0f766e',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    right: 0,
    minWidth: 220,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuItemDanger: {
    color: '#dc2626',
  },
});

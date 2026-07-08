import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectAuthProfile,
  selectAuthUser,
} from '../../viewmodel/auth/authSelectors';
import { loadUserProfile, logoutUser } from '../../viewmodel/auth/authSlice';
import EditAccountScreen from '../profile/EditAccountScreen';
import PurchasedProductsScreen from '../profile/PurchasedProductsScreen';
import ReservationHistoryScreen from '../profile/ReservationHistoryScreen';
import VisitedStoresScreen from '../profile/VisitedStoresScreen';

const ACTIVITY_ITEMS = [
  {
    key: 'reservation-history',
    label: 'Lịch sử giữ hàng',
    icon: '🕐',
  },
  {
    key: 'visited-stores',
    label: 'Gian hàng đã ghé',
    icon: '🏪',
  },
  {
    key: 'purchased-products',
    label: 'Sản phẩm đã từng mua',
    icon: '📦',
  },
];

export default function ProfilePanel({ onOpenStore }) {
  const dispatch = useDispatch();
  const profile = useSelector(selectAuthProfile);
  const user = useSelector(selectAuthUser);
  const [profileNav, setProfileNav] = useState(null);

  const displayName = profile?.fullName || user?.displayName || 'Fastmark user';

  useEffect(() => {
    if (!user || profile) {
      return;
    }
    dispatch(loadUserProfile());
  }, [dispatch, user, profile]);

  if (profileNav === 'edit-account') {
    return <EditAccountScreen onBack={() => setProfileNav(null)} />;
  }

  if (profileNav === 'reservation-history') {
    return (
      <ReservationHistoryScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'visited-stores') {
    return (
      <VisitedStoresScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  if (profileNav === 'purchased-products') {
    return (
      <PurchasedProductsScreen
        onBack={() => setProfileNav(null)}
        onOpenStore={onOpenStore}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.headerEmail} numberOfLines={1}>{user?.email}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
          onPress={() => dispatch(logoutUser())}
        >
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [styles.menuCard, pressed && styles.menuCardPressed]}
          onPress={() => setProfileNav('edit-account')}
        >
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuLabel}>Sửa thông tin tài khoản</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🛒</Text>
          <Text style={styles.sectionTitle}>HOẠT ĐỘNG CỦA TÔI</Text>
        </View>

        <View style={styles.activityCard}>
          {ACTIVITY_ITEMS.map((item, index) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.activityItem,
                index < ACTIVITY_ITEMS.length - 1 && styles.activityItemBorder,
                pressed && styles.menuCardPressed,
              ]}
              onPress={() => setProfileNav(item.key)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#0f766e',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  headerEmail: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  logoutButtonPressed: {
    opacity: 0.7,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 32,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuCardPressed: {
    opacity: 0.75,
  },
  menuIcon: {
    fontSize: 20,
    width: 28,
  },
  menuLabel: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  menuChevron: {
    color: '#94a3b8',
    fontSize: 22,
    fontWeight: '400',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
});

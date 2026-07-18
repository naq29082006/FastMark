import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import {
  loadNotificationSettings,
  saveNotificationSettings,
} from '../../core/storage/notificationSettingsStorage';
import ProfileSubScreen from './ProfileSubScreen';

export default function NotificationSettingsScreen({ onBack }) {
  const [settings, setSettings] = useState({
    orderNotifications: true,
    systemNotifications: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadNotificationSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false));
  }, []);

  async function updateSetting(key, value) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setIsSaving(true);
    try {
      await saveNotificationSettings(next);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ProfileSubScreen title="Cài đặt thông báo" onBack={onBack}>
      {isLoading ? (
        <ActivityIndicator color="#076F32" style={styles.loader} />
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.title}>Nhận thông báo đơn hàng</Text>
                <Text style={styles.subtitle}>
                  Cập nhật trạng thái giữ hàng, xác nhận và giao hàng.
                </Text>
              </View>
              <Switch
                value={settings.orderNotifications}
                onValueChange={(value) => updateSetting('orderNotifications', value)}
                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                thumbColor={settings.orderNotifications ? '#076F32' : '#f8fafc'}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.title}>Nhận thông báo hệ thống</Text>
                <Text style={styles.subtitle}>
                  Khuyến mãi, bảo trì và thông báo quan trọng từ Fastmark.
                </Text>
              </View>
              <Switch
                value={settings.systemNotifications}
                onValueChange={(value) => updateSetting('systemNotifications', value)}
                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                thumbColor={settings.systemNotifications ? '#076F32' : '#f8fafc'}
              />
            </View>
          </View>

          {isSaving ? <Text style={styles.savingText}>Đang lưu...</Text> : null}
        </>
      )}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  title: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  savingText: {
    marginTop: 8,
    color: '#076F32',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});

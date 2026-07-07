import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectApiConfig,
  selectApiDiagnostics,
  selectApiError,
  selectApiHealth,
  selectApiStatus,
  selectApiTestStatus,
} from '../../viewmodel/api/apiSelectors';
import { loadApiOverview, resetApiTest, testApiConnection } from '../../viewmodel/api/apiSlice';

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({ online, label }) {
  return (
    <View style={[styles.badge, online ? styles.badgeOnline : styles.badgeOffline]}>
      <Text style={[styles.badgeText, online ? styles.badgeTextOnline : styles.badgeTextOffline]}>
        {label}
      </Text>
    </View>
  );
}

export default function ApiScreen() {
  const dispatch = useDispatch();
  const status = useSelector(selectApiStatus);
  const testStatus = useSelector(selectApiTestStatus);
  const config = useSelector(selectApiConfig);
  const diagnostics = useSelector(selectApiDiagnostics);
  const health = useSelector(selectApiHealth);
  const error = useSelector(selectApiError);

  const isLoadingOverview = status === 'loading';
  const isTesting = testStatus === 'loading';

  useEffect(() => {
    dispatch(loadApiOverview());
  }, [dispatch]);

  function handleTestConnection() {
    dispatch(resetApiTest());
    dispatch(testApiConnection());
  }

  function handleRefresh() {
    dispatch(loadApiOverview());
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Quản lý API</Text>
        <Text style={styles.subtitle}>Kiểm tra kết nối backend Node.js và cấu hình hệ thống</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cấu hình API</Text>
        {isLoadingOverview && !config ? (
          <ActivityIndicator color="#0f766e" style={styles.loader} />
        ) : (
          <>
            <InfoRow label="Base URL" value={config?.displayUrl || '—'} />
            <InfoRow
              label="Trạng thái cấu hình"
              value={config?.configured ? 'Đã cấu hình' : 'Chưa cấu hình (.env)'}
            />
            <InfoRow label="Biến môi trường" value="EXPO_PUBLIC_NODE_API_URL" />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kiểm tra kết nối</Text>
        <Text style={styles.cardHint}>
          Gửi request GET tới endpoint gốc của backend (ví dụ: http://192.168.1.10:5000/)
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            isTesting && styles.primaryButtonDisabled,
          ]}
          disabled={isTesting}
          onPress={handleTestConnection}
        >
          <Text style={styles.primaryButtonText}>
            {isTesting ? 'Đang kiểm tra...' : 'Kiểm tra API'}
          </Text>
        </Pressable>

        {health ? (
          <View style={styles.resultBox}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Kết quả</Text>
              <StatusBadge
                online={health.online}
                label={health.online ? 'Online' : 'Offline'}
              />
            </View>
            <InfoRow label="HTTP status" value={health.statusCode ?? '—'} />
            <InfoRow label="Độ trễ" value={health.latencyMs != null ? `${health.latencyMs} ms` : '—'} />
            <InfoRow label="Phản hồi" value={health.message || '—'} />
          </View>
        ) : null}
      </View>

      {diagnostics ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hệ thống liên quan</Text>
          <InfoRow label="Firebase project" value={diagnostics.firebase?.projectId || '—'} />
          <InfoRow label="Firebase auth domain" value={diagnostics.firebase?.authDomain || '—'} />
          <InfoRow label="Node API (.env)" value={diagnostics.nodeApiUrl || '—'} />
          <InfoRow
            label="Runtime"
            value={diagnostics.runtime?.isExpoGo ? 'Expo Go' : 'Dev build / Native'}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
        onPress={handleRefresh}
      >
        <Text style={styles.secondaryButtonText}>Tải lại thông tin</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    padding: 16,
    paddingTop: 56,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 10,
  },
  cardHint: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
    marginBottom: 14,
  },
  infoRow: {
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 20,
  },
  loader: {
    marginVertical: 12,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  resultBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeOnline: {
    backgroundColor: '#dcfce7',
  },
  badgeOffline: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  badgeTextOnline: {
    color: '#15803d',
  },
  badgeTextOffline: {
    color: '#b91c1c',
  },
  errorBox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b91c1c',
    lineHeight: 18,
  },
});

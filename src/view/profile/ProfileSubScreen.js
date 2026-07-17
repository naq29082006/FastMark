import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useScreenInsets } from '../../hooks/useScreenInsets';
import CircularBackButton from '../shared/components/CircularBackButton';

export default function ProfileSubScreen({
  title,
  onBack,
  embedded = false,
  refreshControl,
  children,
}) {
  const insets = useScreenInsets();

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          embedded ? styles.headerPlain : styles.topBar,
          !embedded && { paddingTop: insets.contentPaddingTop, paddingBottom: 14 },
        ]}
      >
        {embedded ? (
          <Text style={styles.titlePlain}>{title}</Text>
        ) : (
          <>
            <CircularBackButton onPress={onBack} variant="plain" style={styles.backButton} />
            <Text style={styles.titleWithBack} numberOfLines={1}>
              {title}
            </Text>
          </>
        )}
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottomSpacing + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  headerPlain: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  titlePlain: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  titleWithBack: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});

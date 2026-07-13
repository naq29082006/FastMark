import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useScreenInsets } from '../../hooks/useScreenInsets';
import CircularBackButton from '../shared/components/CircularBackButton';

export default function ProfileSubScreen({ title, onBack, embedded = false, children }) {
  const insets = useScreenInsets();

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.topBar,
          embedded && styles.topBarEmbedded,
          { paddingTop: embedded ? 8 : insets.contentPaddingTop },
          { paddingBottom: 14 },
        ]}
      >
        {embedded ? (
          <View style={styles.topBarSpacer} />
        ) : (
          <CircularBackButton onPress={onBack} variant="light" />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottomSpacing + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
  topBarEmbedded: {},
  title: {
    flex: 1,
    marginHorizontal: 12,
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBarSpacer: {
    width: 36,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 32,
  },
});

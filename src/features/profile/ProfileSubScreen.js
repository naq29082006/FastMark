import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileSubScreen({ title, onBack, children }) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
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
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f766e',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
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

import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ClearableSearchField({
  value,
  onChangeText,
  placeholder,
  style,
  inputStyle,
  returnKeyType = 'search',
  onSubmitEditing,
  autoCapitalize = 'none',
  autoCorrect = false,
  autoFocus = false,
  inputRef = null,
  onFocus,
  onBlur,
}) {
  const hasValue = String(value || '').length > 0;

  return (
    <View style={[styles.searchWrap, style]}>
      <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        style={[styles.searchInput, inputStyle]}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
        clearButtonMode="never"
      />
      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xóa tìm kiếm"
          hitSlop={8}
          onPress={() => onChangeText?.('')}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={20} color="#94a3b8" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: '#1f2937',
    paddingVertical: 10,
    margin: 0,
  },
  clearButton: {
    marginLeft: 6,
    padding: 2,
  },
});

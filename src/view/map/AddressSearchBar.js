import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { searchMapAddresses } from '../../viewmodel/map/mapViewModel';

export default function AddressSearchBar({ onSelectResult }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setError('');
      setIsSearching(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setIsSearching(true);
      setError('');

      try {
        const matches = await searchMapAddresses(trimmed);

        if (requestIdRef.current !== requestId) {
          return;
        }

        setResults(matches);
        if (matches.length === 0) {
          setError('Không tìm thấy địa chỉ phù hợp.');
        }
      } catch (searchError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setResults([]);
        setError(searchError?.message || 'Không tìm được địa chỉ.');
      } finally {
        if (requestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelectResult(result) {
    setQuery(result.label);
    setResults([]);
    setError('');
    setIsFocused(false);
    onSelectResult?.(result);
  }

  function handleClear() {
    requestIdRef.current += 1;
    setQuery('');
    setResults([]);
    setError('');
    setIsSearching(false);
  }

  const showDropdown = isFocused && (isSearching || results.length > 0 || error);

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm địa chỉ, quận, thành phố..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
          returnKeyType="search"
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 150);
          }}
        />
        {isSearching ? <ActivityIndicator size="small" color="#0f766e" /> : null}
        {query.length > 0 && !isSearching ? (
          <Pressable accessibilityRole="button" onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {results.map((result) => (
              <Pressable
                key={result.id}
                style={({ pressed }) => [styles.resultItem, pressed && styles.resultItemPressed]}
                onPress={() => handleSelectResult(result)}
              >
                <Text style={styles.resultLabel} numberOfLines={2}>
                  {result.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 10,
    zIndex: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 10,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    marginLeft: 8,
  },
  clearButtonText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  dropdown: {
    marginTop: 8,
    maxHeight: 220,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  resultItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultItemPressed: {
    backgroundColor: '#f8fafc',
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 18,
  },
  errorText: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#b91c1c',
  },
});

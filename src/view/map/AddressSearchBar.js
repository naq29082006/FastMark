import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { searchMapAddresses } from '../../viewmodel/map/mapViewModel';

export default function AddressSearchBar({ onSelectResult, onFocusChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const requestIdRef = useRef(0);
  const blurTimerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    onFocusChange?.(isFocused);
  }, [isFocused, onFocusChange]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
      onFocusChange?.(false);
    };
  }, [onFocusChange]);

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

  function cancelBlurTimer() {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }

  function handleSelectResult(result) {
    cancelBlurTimer();
    // Cancel in-flight search and reset field so the next search starts clean.
    requestIdRef.current += 1;
    setQuery('');
    setResults([]);
    setError('');
    setIsSearching(false);
    setIsFocused(false);
    Keyboard.dismiss();
    inputRef.current?.blur?.();
    onSelectResult?.(result);
  }

  function handleClear() {
    cancelBlurTimer();
    requestIdRef.current += 1;
    setQuery('');
    setResults([]);
    setError('');
    setIsSearching(false);
    setIsFocused(true);
    inputRef.current?.focus?.();
  }

  const showDropdown = isFocused && (isSearching || results.length > 0 || Boolean(error));

  return (
    <View style={styles.wrapper} collapsable={false}>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder || 'Tìm đường, địa điểm...'}
          placeholderTextColor="#9ca3af"
          style={styles.input}
          returnKeyType="search"
          onFocus={() => {
            cancelBlurTimer();
            setIsFocused(true);
          }}
          onBlur={() => {
            cancelBlurTimer();
            // Delay blur so dropdown presses still register before focus drops.
            blurTimerRef.current = setTimeout(() => {
              setIsFocused(false);
            }, 220);
          }}
        />
        {isSearching ? <ActivityIndicator size="small" color="#076F32" /> : null}
        {query.length > 0 && !isSearching ? (
          <Pressable accessibilityRole="button" onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled>
            {results.map((result) => (
              <Pressable
                key={result.id}
                style={({ pressed }) => [styles.resultItem, pressed && styles.resultItemPressed]}
                onPressIn={cancelBlurTimer}
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
    zIndex: 40,
    elevation: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1f2937',
    paddingVertical: 12,
  },
  clearButton: {
    marginLeft: 4,
    padding: 2,
  },
  dropdown: {
    marginTop: 8,
    maxHeight: 220,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    elevation: 10,
    zIndex: 41,
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

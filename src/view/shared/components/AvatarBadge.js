import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getAvatarInitial, isRemoteAvatarUrl } from '../../../core/utils/avatarInitial';

/**
 * Shows a remote photo when available; otherwise a circular placeholder
 * with the uppercase first letter of `name`.
 */
export default function AvatarBadge({
  name,
  uri,
  size = 64,
  backgroundColor = '#076F32',
  style,
  textStyle,
}) {
  const [imageError, setImageError] = useState(false);
  const resolvedUrl = isRemoteAvatarUrl(uri) ? String(uri).trim() : '';
  const showImage = Boolean(resolvedUrl) && !imageError;
  const initial = getAvatarInitial(name);

  useEffect(() => {
    setImageError(false);
  }, [resolvedUrl]);

  if (showImage) {
    return (
      <Image
        source={{ uri: resolvedUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style,
        ]}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        style,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.fallbackText, { fontSize: size * 0.42 }, textStyle]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#e2e8f0',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});

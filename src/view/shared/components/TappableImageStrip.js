import { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function normalizeImageUri(image) {
  if (!image) {
    return '';
  }
  if (typeof image === 'string') {
    return image.trim();
  }
  return String(image.imageUrl || image.ImageUrl || image.url || '').trim();
}

export default function TappableImageStrip({
  images = [],
  thumbStyle,
  containerStyle,
}) {
  const [previewIndex, setPreviewIndex] = useState(null);
  const uris = useMemo(
    () =>
      (Array.isArray(images) ? images : [])
        .map(normalizeImageUri)
        .filter(Boolean),
    [images]
  );

  if (!uris.length) {
    return null;
  }

  const closePreview = () => setPreviewIndex(null);
  const showPrev = () => {
    setPreviewIndex((current) => Math.max(0, (current ?? 0) - 1));
  };
  const showNext = () => {
    setPreviewIndex((current) => Math.min(uris.length - 1, (current ?? 0) + 1));
  };
  const currentIndex = previewIndex ?? 0;
  const currentUri = uris[currentIndex] || '';

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.strip, containerStyle]}
      >
        {uris.map((uri, index) => (
          <Pressable
            key={`${uri}-${index}`}
            onPress={() => setPreviewIndex(index)}
            accessibilityRole="button"
            accessibilityLabel={`Xem ảnh ${index + 1}`}
          >
            <Image source={{ uri }} style={[styles.thumb, thumbStyle]} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={previewIndex != null}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={styles.closeBtn}
            onPress={closePreview}
            accessibilityRole="button"
            accessibilityLabel="Đóng xem ảnh"
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          {uris.length > 1 ? (
            <>
              <Pressable
                style={[styles.navBtn, styles.navBtnLeft]}
                onPress={showPrev}
                disabled={currentIndex <= 0}
                accessibilityRole="button"
                accessibilityLabel="Ảnh trước"
              >
                <Ionicons
                  name="chevron-back"
                  size={28}
                  color={currentIndex <= 0 ? '#64748b' : '#fff'}
                />
              </Pressable>
              <Pressable
                style={[styles.navBtn, styles.navBtnRight]}
                onPress={showNext}
                disabled={currentIndex >= uris.length - 1}
                accessibilityRole="button"
                accessibilityLabel="Ảnh sau"
              >
                <Ionicons
                  name="chevron-forward"
                  size={28}
                  color={currentIndex >= uris.length - 1 ? '#64748b' : '#fff'}
                />
              </Pressable>
              <Text style={styles.counter}>
                {currentIndex + 1}/{uris.length}
              </Text>
            </>
          ) : null}

          {currentUri ? (
            <Image source={{ uri: currentUri }} style={styles.fullImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginTop: 4,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fullImage: {
    width: '100%',
    height: '78%',
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    padding: 8,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    zIndex: 2,
    padding: 8,
  },
  navBtnLeft: {
    left: 8,
  },
  navBtnRight: {
    right: 8,
  },
  counter: {
    position: 'absolute',
    bottom: 40,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
});

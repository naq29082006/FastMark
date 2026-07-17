import {
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

function parseImageAsset(result) {
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    base64: asset.base64,
    mimeType: asset.mimeType || 'image/jpeg',
    uri: asset.uri,
  };
}

async function pickImageFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập thư viện ảnh.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
    base64: true,
  });

  return parseImageAsset(result);
}

async function takePhotoWithCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập camera.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.7,
    base64: true,
  });

  return parseImageAsset(result);
}

export async function pickChatImageFromLibrary() {
  return pickImageFromLibrary();
}

export function chooseChatImageSource() {
  if (Platform.OS === 'web') {
    return pickImageFromLibrary();
  }

  return new Promise((resolve, reject) => {
    Alert.alert(
      'Chọn ảnh',
      'Bạn muốn chụp ảnh bằng camera hay chọn từ thư viện?',
      [
        { text: 'Huỷ', style: 'cancel', onPress: () => resolve(null) },
        {
          text: 'Chụp ảnh',
          onPress: () => {
            takePhotoWithCamera().then(resolve).catch(reject);
          },
        },
        {
          text: 'Thư viện ảnh',
          onPress: () => {
            pickImageFromLibrary().then(resolve).catch(reject);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}

export function buildChatImagePayload(image) {
  if (!image?.base64) {
    throw new Error('Không đọc được ảnh đã chọn. Vui lòng thử lại.');
  }

  return {
    uri: image.uri,
    imageContent: `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`,
  };
}

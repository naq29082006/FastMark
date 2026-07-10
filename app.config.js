const appJson = require('./app.json');
const googleServices = require('./google-services.json');

function getAndroidOAuthClientId() {
  const envId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const clients = googleServices?.client?.[0]?.oauth_client || [];
  const androidIds = clients
    .filter((client) => client.client_type === 1)
    .map((client) => client.client_id)
    .filter(Boolean);

  if (envId && androidIds.includes(envId)) {
    return envId;
  }

  return androidIds[0] || '';
}

function reverseGoogleClientIdScheme(clientId) {
  if (!clientId) {
    return '';
  }

  return clientId.split('.').reverse().join('.');
}

module.exports = () => {
  const expo = { ...appJson.expo };
  const googleScheme = reverseGoogleClientIdScheme(getAndroidOAuthClientId());

  expo.android = {
    ...expo.android,
    permissions: ['INTERNET', 'ACCESS_NETWORK_STATE', 'CAMERA'],
    ...(googleScheme
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              data: [
                {
                  scheme: googleScheme,
                  path: '/oauthredirect',
                },
              ],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }
      : {}),
  };

  expo.ios = {
    ...expo.ios,
    infoPlist: {
      ...(expo.ios?.infoPlist || {}),
      NSCameraUsageDescription:
        'Fastmark cần truy cập camera để chụp ảnh giấy tờ đăng ký gian hàng.',
      NSPhotoLibraryUsageDescription:
        'Fastmark cần truy cập thư viện ảnh để tải ảnh giấy tờ đăng ký gian hàng.',
      CFBundleURLTypes: [
        { CFBundleURLSchemes: ['fastmark'] },
        ...(googleScheme ? [{ CFBundleURLSchemes: [googleScheme] }] : []),
      ],
    },
  };

  return { expo };
};

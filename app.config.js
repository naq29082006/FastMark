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
    permissions: ['INTERNET', 'ACCESS_NETWORK_STATE'],
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
      CFBundleURLTypes: [
        { CFBundleURLSchemes: ['fastmark'] },
        ...(googleScheme ? [{ CFBundleURLSchemes: [googleScheme] }] : []),
      ],
    },
  };

  return { expo };
};

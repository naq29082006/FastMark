import googleServices from '../../../google-services.json';

function readAndroidClient() {
  return googleServices?.client?.[0] || null;
}

function readOAuthClientId(clientType) {
  const oauthClients = readAndroidClient()?.oauth_client || [];
  const match = oauthClients.find((client) => client.client_type === clientType);
  return match?.client_id || '';
}

// client_type: 1 = Android, 3 = Web
export function getAndroidOAuthClientIdFromGoogleServices() {
  return readOAuthClientId(1);
}

export function getWebOAuthClientIdFromGoogleServices() {
  return readOAuthClientId(3);
}

export function getAndroidFirebaseConfigFromGoogleServices() {
  const client = readAndroidClient();
  const projectId = googleServices?.project_info?.project_id || '';

  return {
    apiKey: client?.api_key?.[0]?.current_key || '',
    appId: client?.client_info?.mobilesdk_app_id || '',
    messagingSenderId: googleServices?.project_info?.project_number || '',
    storageBucket: googleServices?.project_info?.storage_bucket || '',
    projectId,
    authDomain: projectId ? `${projectId}.firebaseapp.com` : '',
  };
}

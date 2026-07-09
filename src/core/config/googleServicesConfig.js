import googleServices from '../../../google-services.json';

function readAndroidClient() {
  return googleServices?.client?.[0] || null;
}

function readOAuthClients() {
  return readAndroidClient()?.oauth_client || [];
}

function readOAuthClientId(clientType) {
  const match = readOAuthClients().find((client) => client.client_type === clientType);
  return match?.client_id || '';
}

export function getAndroidOAuthClientIdsFromGoogleServices() {
  return readOAuthClients()
    .filter((client) => client.client_type === 1)
    .map((client) => client.client_id)
    .filter(Boolean);
}

export function resolveAndroidOAuthClientId(preferredId = '') {
  const androidIds = getAndroidOAuthClientIdsFromGoogleServices();
  if (preferredId && androidIds.includes(preferredId)) {
    return preferredId;
  }
  return androidIds[0] || '';
}

// client_type: 1 = Android, 3 = Web
export function getAndroidOAuthClientIdFromGoogleServices() {
  return resolveAndroidOAuthClientId();
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

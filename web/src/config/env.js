const env = import.meta.env;

export const apiUrl =
  env.VITE_API_URL || env.EXPO_PUBLIC_NODE_API_URL || 'http://localhost:5000';

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID || env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET || env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

const requiredFirebaseKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function getFirebaseConfigError() {
  const missing = requiredFirebaseKeys.filter((key) => !firebaseConfig[key]);
  if (missing.length === 0) {
    return null;
  }

  return `Thiếu cấu hình Firebase trong .env (gốc dự án): ${missing
    .map((key) => `EXPO_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`)
    .join(', ')}`;
}

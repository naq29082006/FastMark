export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const requiredFirebaseKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function getFirebaseConfigError() {
  const missing = requiredFirebaseKeys.filter((key) => !firebaseConfig[key]);
  if (missing.length === 0) {
    return null;
  }

  return `Thiếu cấu hình Firebase trong web/.env: ${missing
    .map((key) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`)
    .join(', ')}`;
}

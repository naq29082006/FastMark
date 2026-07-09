const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let initialized = false;

function loadServiceAccountFromFile() {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    return JSON.parse(jsonEnv);
  }

  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (accountPath) {
    const resolved = path.isAbsolute(accountPath)
      ? accountPath
      : path.resolve(process.cwd(), accountPath);
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }

  return null;
}

function loadServiceAccountFromEnv() {
  try {
    const {
      firebaseProjectId,
      firebaseClientEmail,
      firebasePrivateKey,
    } = require('./env');

    if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
      return {
        project_id: firebaseProjectId,
        client_email: firebaseClientEmail,
        private_key: firebasePrivateKey,
      };
    }
  } catch {
    // env.js may throw if required vars are missing during partial setup.
  }

  return null;
}

function initFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) {
    return admin;
  }

  const serviceAccount = loadServiceAccountFromFile() || loadServiceAccountFromEnv();
  const projectId =
    serviceAccount?.project_id ||
    process.env.FIREBASE_PROJECT_ID ||
    'fastmark-e881d';

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } else {
    admin.initializeApp({ projectId });
    console.warn(
      '[Firebase Admin] No service account configured. Token verify uses projectId only.'
    );
  }

  initialized = true;
  console.log('Firebase Admin initialized:', admin.app().name);
  return admin;
}

const firebaseAdmin = initFirebaseAdmin();

module.exports = {
  initFirebaseAdmin,
  admin: firebaseAdmin,
  auth: firebaseAdmin.auth(),
  app: firebaseAdmin.apps[0] || null,
};

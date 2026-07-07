const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let initialized = false;

function loadServiceAccount() {
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

function initFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) {
    return admin;
  }

  const serviceAccount = loadServiceAccount();
  const projectId = process.env.FIREBASE_PROJECT_ID || 'fastmark-e881d';

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
  } else {
    // verifyIdToken works with projectId only (fetches Google public keys).
    admin.initializeApp({ projectId });
    console.warn(
      '[Firebase Admin] No service account configured. Token verify uses projectId only.'
    );
  }

  initialized = true;
  return admin;
}

module.exports = { initFirebaseAdmin, admin };

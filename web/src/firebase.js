import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

import { firebaseConfig, getFirebaseConfigError } from './config/env';

const configError = getFirebaseConfigError();

let app = null;
let auth = null;

if (!configError) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export { auth, configError };

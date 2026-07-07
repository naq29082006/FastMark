import { configureStore } from '@reduxjs/toolkit';

import apiReducer from '../../viewmodel/api/apiSlice';
import authReducer from '../../viewmodel/auth/authSlice';
import { createLogger } from '../utils/logger';

const log = createLogger('Redux');

const actionLoggerMiddleware = () => (next) => (action) => {
  if (action?.type?.startsWith('auth/') || action?.type?.startsWith('api/')) {
    log.debug('action', action.type, action.payload ?? '');
  }
  return next(action);
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    api: apiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(actionLoggerMiddleware),
});

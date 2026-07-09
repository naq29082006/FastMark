const DEBUG_ENABLED = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

function formatTime() {
  return new Date().toISOString().slice(11, 23);
}

function formatMessage(scope, level, args) {
  return [`[${formatTime()}][Fastmark:${scope}][${level}]`, ...args];
}

export function isRequestCanceled(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.name === 'AbortError' ||
    message.includes('canceled') ||
    message.includes('cancelled') ||
    message.includes('aborted')
  );
}

export function logErrorDetails(scope, label, error) {
  const prefix = `[${formatTime()}][Fastmark:${scope}][ERROR] ${label}`;
  console.error(prefix, {
    error,
    code: error?.code ?? null,
    message: error?.message ?? null,
    stack: error?.stack ?? null,
    name: error?.name ?? null,
  });
}

export function createLogger(scope) {
  return {
    debug(...args) {
      if (DEBUG_ENABLED) {
        console.log(...formatMessage(scope, 'DEBUG', args));
      }
    },
    info(...args) {
      console.info(...formatMessage(scope, 'INFO', args));
    },
    warn(...args) {
      console.warn(...formatMessage(scope, 'WARN', args));
    },
    error(...args) {
      console.error(...formatMessage(scope, 'ERROR', args));
    },
    ok(message, details) {
      this.info(message, details ?? '');
    },
    fail(message, error) {
      if (isRequestCanceled(error)) {
        this.debug(message, 'request canceled');
        return;
      }
      logErrorDetails(scope, message, error);
    },
    step(message, details) {
      console.log(...formatMessage(scope, 'STEP', [message, details ?? '']));
    },
  };
}

export const appLogger = createLogger('App');
export const authLogger = createLogger('Auth');
export const mapLogger = createLogger('Map');
export const storeLogger = createLogger('Store');
export const firestoreLogger = createLogger('Firestore');
export const profileLogger = createLogger('Profile');
export const googleLogger = createLogger('GoogleAuth');

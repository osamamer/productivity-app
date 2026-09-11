const { existsSync } = require('fs');
const { isAbsolute, resolve } = require('path');

const LOCAL_GOOGLE_SERVICES_FILE = './google-services.json';

function googleServicesFile() {
  const configuredPath = process.env.GOOGLE_SERVICES_JSON;
  if (configuredPath) return configuredPath;
  return existsSync(resolve(__dirname, LOCAL_GOOGLE_SERVICES_FILE))
    ? LOCAL_GOOGLE_SERVICES_FILE
    : undefined;
}

function fileExists(file) {
  return existsSync(isAbsolute(file) ? file : resolve(__dirname, file));
}

module.exports = ({ config }) => {
  const firebaseConfig = googleServicesFile();
  const environment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

  if (environment !== 'development' && (!firebaseConfig || !fileExists(firebaseConfig))) {
    throw new Error(
      'Android remote push requires GOOGLE_SERVICES_JSON or frontend/mobile/google-services.json.',
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      ...(firebaseConfig ? { googleServicesFile: firebaseConfig } : {}),
    },
    extra: {
      ...config.extra,
      remotePushConfigured: Boolean(firebaseConfig),
    },
  };
};

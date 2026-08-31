type MobileEnvironment = 'development' | 'preview' | 'production';

const configuredEnvironment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
if (!['development', 'preview', 'production'].includes(configuredEnvironment)) {
  throw new Error(`EXPO_PUBLIC_APP_ENV must be development, preview, or production.`);
}

const environment = configuredEnvironment as MobileEnvironment;
const isDeployedBuild = environment === 'preview' || environment === 'production';

function resolveOrigin(
  name: string,
  configuredValue: string | undefined,
  developmentFallback?: string,
): string {
  const configured = configuredValue?.trim() || developmentFallback;
  if (!configured) {
    throw new Error(`${name} must be configured for the ${environment} mobile build.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`${name} must be a valid http(s) URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use http:// or https://.`);
  }

  const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (isDeployedBuild && (parsed.protocol !== 'https:' || isLoopback)) {
    throw new Error(`${name} must use a public HTTPS origin in a ${environment} mobile build.`);
  }

  return configured.replace(/\/+$/, '');
}

export const appConfig = {
  environment,
  apiUrl: resolveOrigin(
    'EXPO_PUBLIC_API_URL',
    process.env.EXPO_PUBLIC_API_URL,
    'http://localhost:8080',
  ),
  keycloakUrl: resolveOrigin(
    'EXPO_PUBLIC_KEYCLOAK_URL',
    process.env.EXPO_PUBLIC_KEYCLOAK_URL,
    'http://localhost:7070',
  ),
  keycloakRealm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'productivity-app',
  keycloakClientId:
    process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'productivity-app-frontend',
  scheme: 'solife',
} as const;

export const keycloakIssuer =
  `${appConfig.keycloakUrl}/realms/${appConfig.keycloakRealm}`;

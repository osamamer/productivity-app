export const appConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080',
  keycloakUrl: process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://localhost:7070',
  keycloakRealm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'productivity-app',
  keycloakClientId:
    process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'productivity-app-frontend',
  scheme: 'solife',
} as const;

export const keycloakIssuer =
  `${appConfig.keycloakUrl}/realms/${appConfig.keycloakRealm}`;

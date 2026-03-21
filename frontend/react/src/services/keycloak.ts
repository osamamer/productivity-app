import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:7070',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'productivity-app',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'productivity-app-frontend',
});

export default keycloak;

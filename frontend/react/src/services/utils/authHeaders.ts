import keycloak from '../keycloak';

export function getAuthHeaders(): Record<string, string> {
    const token = keycloak.token;
    if (token) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}

import keycloak from '../keycloak';

export function getAuthHeaders(): Record<string, string> {
    const token = keycloak.token;
    if (token) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}

// Cache keys must not allow data from one authenticated user to be reused by another.
export function getAuthCacheScope(): string {
    return keycloak.tokenParsed?.sub ?? 'anonymous';
}

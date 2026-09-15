import axios from 'axios';
import keycloak, {
    isDefinitiveRefreshFailure,
    redirectToSignIn,
    refreshAuthToken,
} from '../keycloak';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(async (config) => {
    try {
        await refreshAuthToken(30);
    } catch (error) {
        if (isDefinitiveRefreshFailure(error)) {
            redirectToSignIn();
        } else {
            // Let the current request use the existing token while a temporary outage recovers.
            console.warn('Could not refresh the API session; continuing with the current token', error);
        }
    }
    if (keycloak.token) {
        config.headers.Authorization = `Bearer ${keycloak.token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
    }
);

export default apiClient;

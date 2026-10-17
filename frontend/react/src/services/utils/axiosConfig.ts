import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import keycloak, {
    isDefinitiveRefreshFailure,
    redirectToSignIn,
    refreshAuthToken,
} from '../keycloak';
import { API_READ_RETRY_DELAYS_MS, API_READ_RETRY_WINDOW_MS } from './apiFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
    retryDeadline?: number;
    retryAttempt?: number;
}

function isTransientFailure(error: unknown): error is AxiosError {
    if (!axios.isAxiosError(error)) return false;
    if (error.response) {
        return error.response.status === 408 || error.response.status === 429 || error.response.status >= 500;
    }
    return ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(error.code ?? '');
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
    if (config.method?.toUpperCase() === 'GET') {
        const retryConfig = config as RetryableRequestConfig;
        retryConfig.retryDeadline ??= Date.now() + API_READ_RETRY_WINDOW_MS;
        const remainingMs = Math.max(1, retryConfig.retryDeadline - Date.now());
        const configuredTimeout = retryConfig.timeout ?? 0;
        retryConfig.timeout = configuredTimeout > 0
            ? Math.min(configuredTimeout, remainingMs)
            : remainingMs;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
        const config = axios.isAxiosError(error)
            ? error.config as RetryableRequestConfig | undefined
            : undefined;
        if (config
            && config.method?.toUpperCase() === 'GET'
            && !config.signal?.aborted
            && isTransientFailure(error)) {
            const retryConfig = config as RetryableRequestConfig;
            const deadline = retryConfig.retryDeadline ?? Date.now();
            const remainingMs = deadline - Date.now();
            if (remainingMs > 0) {
                const attempt = retryConfig.retryAttempt ?? 0;
                const delayMs = API_READ_RETRY_DELAYS_MS[
                    Math.min(attempt, API_READ_RETRY_DELAYS_MS.length - 1)
                ];
                if (delayMs < remainingMs) {
                    await wait(delayMs);
                    if (!config.signal?.aborted && Date.now() < deadline) {
                        retryConfig.retryAttempt = attempt + 1;
                        return apiClient.request(retryConfig);
                    }
                } else {
                    await wait(remainingMs);
                }
            }
        }

        console.error('API Error:', error);
        return Promise.reject(error);
    }
);

export default apiClient;

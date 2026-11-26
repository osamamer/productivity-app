import keycloak, { refreshAuthToken, isDefinitiveRefreshFailure, redirectToSignIn } from '../keycloak';
import { reportServerAvailability } from '../backup/backupAvailability';

export const API_READ_RETRY_WINDOW_MS = 3_000;
export const API_READ_RETRY_DELAYS_MS = [250, 500, 750, 1_000] as const;

function isRetryableStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
}

function retryDelay(attempt: number): number {
    return API_READ_RETRY_DELAYS_MS[Math.min(attempt, API_READ_RETRY_DELAYS_MS.length - 1)];
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<boolean> {
    return new Promise(resolve => {
        if (signal.aborted) {
            resolve(false);
            return;
        }

        function handleAbort() {
            clearTimeout(timeoutId);
            resolve(false);
        }
        const timeoutId = setTimeout(() => {
            signal.removeEventListener('abort', handleAbort);
            resolve(true);
        }, delayMs);
        signal.addEventListener('abort', handleAbort, { once: true });
    });
}

async function discardResponse(response: Response): Promise<void> {
    try {
        await response.body?.cancel();
    } catch (error) {
        console.warn('Could not discard a failed API response body:', error);
    }
}

/**
 * Sends writes once and retries transient GET failures only during the first three seconds.
 * The retry window does not abort an in-flight request.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
    const method = (init.method ?? request?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers ?? request?.headers);
    if (headers.has('Authorization')) {
        try {
            await refreshAuthToken(30);
        } catch (error) {
            if (isDefinitiveRefreshFailure(error)) {
                redirectToSignIn();
                throw error;
            }
            console.warn('Could not refresh the API session; continuing with the current token', error);
        }
        if (keycloak.token) headers.set('Authorization', `Bearer ${keycloak.token}`);
        init = { ...init, headers };
    }
    if (method !== 'GET') return fetch(input, init);

    const callerSignal = init.signal ?? request?.signal;
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(callerSignal?.reason);
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (callerSignal?.aborted) abortFromCaller();

    const deadline = Date.now() + API_READ_RETRY_WINDOW_MS;
    let attempt = 0;

    try {
        for (;;) {
            try {
                const response = await fetch(input, { ...init, signal: controller.signal });
                if (!isRetryableStatus(response.status)) {
                    if (response.ok) reportServerAvailability(true);
                    return response;
                }

                const remainingMs = deadline - Date.now();
                if (remainingMs <= 0) { reportServerAvailability(false); return response; }

                const delayMs = retryDelay(attempt++);
                if (delayMs >= remainingMs) {
                    await waitForRetry(remainingMs, controller.signal);
                    if (callerSignal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
                    reportServerAvailability(false);
                    return response;
                }
                await discardResponse(response);
                if (!await waitForRetry(delayMs, controller.signal)) {
                    if (callerSignal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
                    return response;
                }
            } catch (error) {
                if (callerSignal?.aborted) throw error;

                const remainingMs = deadline - Date.now();
                if (remainingMs <= 0) { reportServerAvailability(false); throw error; }

                const delayMs = retryDelay(attempt++);
                if (delayMs >= remainingMs) {
                    await waitForRetry(remainingMs, controller.signal);
                    if (callerSignal?.aborted) throw error;
                    reportServerAvailability(false);
                    throw error;
                }
                if (!await waitForRetry(delayMs, controller.signal)) {
                    if (callerSignal?.aborted) throw error;
                    throw error;
                }
            }
        }
    } finally {
        callerSignal?.removeEventListener('abort', abortFromCaller);
    }
}

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

        let timeoutId: ReturnType<typeof setTimeout>;
        const handleAbort = () => {
            clearTimeout(timeoutId);
            resolve(false);
        };
        timeoutId = setTimeout(() => {
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

/** Retries transient API reads for at most three seconds. Writes are sent once. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
    const method = (init.method ?? request?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') return fetch(input, init);

    const callerSignal = init.signal ?? request?.signal;
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(callerSignal?.reason);
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (callerSignal?.aborted) abortFromCaller();

    const deadline = Date.now() + API_READ_RETRY_WINDOW_MS;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, API_READ_RETRY_WINDOW_MS);
    let attempt = 0;

    try {
        while (true) {
            try {
                const response = await fetch(input, { ...init, signal: controller.signal });
                if (!isRetryableStatus(response.status)) return response;

                const remainingMs = deadline - Date.now();
                if (remainingMs <= 0) return response;

                const delayMs = retryDelay(attempt++);
                if (delayMs >= remainingMs) {
                    await waitForRetry(remainingMs, controller.signal);
                    if (callerSignal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
                    return response;
                }
                await discardResponse(response);
                if (!await waitForRetry(delayMs, controller.signal)) {
                    if (callerSignal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
                    if (timedOut) throw new Error('API request failed after three seconds');
                    return response;
                }
            } catch (error) {
                if (callerSignal?.aborted) throw error;
                if (timedOut) throw new Error('API request failed after three seconds');

                const remainingMs = deadline - Date.now();
                if (remainingMs <= 0) throw error;

                const delayMs = retryDelay(attempt++);
                if (delayMs >= remainingMs) {
                    await waitForRetry(remainingMs, controller.signal);
                    if (callerSignal?.aborted) throw error;
                    throw new Error('API request failed after three seconds');
                }
                if (!await waitForRetry(delayMs, controller.signal)) {
                    if (callerSignal?.aborted) throw error;
                    throw new Error('API request failed after three seconds');
                }
            }
        }
    } finally {
        clearTimeout(timeoutId);
        callerSignal?.removeEventListener('abort', abortFromCaller);
    }
}

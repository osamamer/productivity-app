// keycloak-js sends its refresh request without a timeout. When that request lands on a
// connection the server end has silently dropped (as a production deploy can do), it hangs
// until the OS gives up, roughly fifteen minutes. keycloak-js also queues every later refresh
// behind it, and every API request waits for the refresh, so the whole app stalls. This
// request gives up instead, letting the next attempt go out on a fresh connection.
export const TOKEN_REFRESH_TIMEOUT_MS = 10_000;

export interface RefreshedTokens {
    access_token: string;
    refresh_token: string;
    id_token?: string;
}

/** The token endpoint answered with an error; `response` lets callers read why. */
export class TokenEndpointError extends Error {
    readonly response: Response;

    constructor(response: Response) {
        super(`The token endpoint answered HTTP ${response.status}`);
        this.name = 'TokenEndpointError';
        this.response = response;
    }
}

export async function requestTokenRefresh(
    tokenUrl: string,
    refreshToken: string,
    clientId: string,
    timeoutMs = TOKEN_REFRESH_TIMEOUT_MS,
): Promise<RefreshedTokens> {
    const response = await fetch(tokenUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
        }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new TokenEndpointError(response);

    const tokens = await response.json() as Partial<RefreshedTokens>;
    if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('The token endpoint answered without tokens');
    }
    return tokens as RefreshedTokens;
}

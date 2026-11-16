// Keycloak answers `invalid_grant` only after it has checked a password or refresh token and
// rejected it. Every other failure (a 5xx, a misconfigured or unreachable server, a database
// outage behind Keycloak) says nothing about the user's credentials, so it must not sign
// them out or be reported as a wrong password.

interface ResponseLike {
    status: number;
    clone(): { json(): Promise<unknown> };
}

function isResponseLike(value: unknown): value is ResponseLike {
    return typeof value === 'object'
        && value !== null
        && typeof (value as ResponseLike).status === 'number'
        && typeof (value as ResponseLike).clone === 'function';
}

export async function isInvalidGrantResponse(response: ResponseLike): Promise<boolean> {
    if (response.status !== 400 && response.status !== 401) return false;
    try {
        const body = await response.clone().json();
        return typeof body === 'object' && body !== null && (body as { error?: unknown }).error === 'invalid_grant';
    } catch {
        return false;
    }
}

/** True when a keycloak-js refresh error means the refresh token itself was rejected. */
export async function isRejectedRefreshError(error: unknown): Promise<boolean> {
    if (typeof error !== 'object' || error === null || !('response' in error)) return false;
    const response = (error as { response?: unknown }).response;
    return isResponseLike(response) && isInvalidGrantResponse(response);
}

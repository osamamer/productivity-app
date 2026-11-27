import { apiFetch } from '../utils/apiFetch';
import { getAuthHeaders } from '../utils/authHeaders';
import type { Path, PathDraft, PathsOverview, PathView, SignalDraft, SignalPreview } from '../../types/Path';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const PATHS_URL = `${API_BASE_URL}/api/v1/paths`;

async function readJson<T>(response: Response, failure: string): Promise<T> {
    if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message && message.length < 200 ? message : failure);
    }
    return response.json() as Promise<T>;
}

function send(url: string, method: string, body: unknown): Promise<Response> {
    return apiFetch(url, {
        method,
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/** `today` is the user's local date, so weeks follow their calendar rather than the server's. */
export const pathService = {
    async getOverview(today: string): Promise<PathsOverview> {
        const url = `${PATHS_URL}/overview?today=${encodeURIComponent(today)}`;
        return readJson(await apiFetch(url, { headers: getAuthHeaders() }), 'Could not load your paths.');
    },

    async createPath(draft: PathDraft): Promise<Path> {
        return readJson(await send(PATHS_URL, 'POST', draft), 'Could not create the path.');
    },

    async updatePath(pathId: string, draft: PathDraft): Promise<Path> {
        return readJson(await send(`${PATHS_URL}/${encodeURIComponent(pathId)}`, 'PATCH', draft), 'Could not save the path.');
    },

    async deletePath(pathId: string): Promise<void> {
        const response = await apiFetch(`${PATHS_URL}/${encodeURIComponent(pathId)}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Could not delete the path.');
    },

    async reorder(pathIds: string[]): Promise<Path[]> {
        return readJson(await send(`${PATHS_URL}/order`, 'PUT', pathIds), 'Could not save the order.');
    },

    async updateView(view: Partial<PathView>): Promise<PathView> {
        return readJson(await send(`${PATHS_URL}/view`, 'PUT', view), 'Could not save the view.');
    },

    async previewSignal(signal: SignalDraft, today: string): Promise<SignalPreview> {
        const url = `${PATHS_URL}/signal-preview?today=${encodeURIComponent(today)}`;
        return readJson(await send(url, 'POST', signal), 'Could not preview the signal.');
    },
};

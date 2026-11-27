import { apiFetch } from '../utils/apiFetch';
import { getAuthHeaders } from '../utils/authHeaders';
import type {
    Checkpoint, CheckpointDraft, Milestone, MilestoneDraft, Path, PathDraft, PathsOverview, PathView, SignalDraft, SignalPreview,
} from '../../types/Path';

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

function checkpointsUrl(projectId: string, checkpointId: string | null, today: string | null): string {
    const base = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/checkpoints`;
    const url = checkpointId ? `${base}/${encodeURIComponent(checkpointId)}` : base;
    return today ? `${url}?today=${encodeURIComponent(today)}` : url;
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

    async createMilestone(pathId: string, draft: MilestoneDraft, today: string): Promise<Milestone> {
        const url = `${PATHS_URL}/${encodeURIComponent(pathId)}/milestones?today=${encodeURIComponent(today)}`;
        return readJson(await send(url, 'POST', draft), 'Could not add the milestone.');
    },

    async updateMilestone(pathId: string, milestoneId: string, draft: MilestoneDraft, today: string): Promise<Milestone> {
        const url = `${PATHS_URL}/${encodeURIComponent(pathId)}/milestones/${encodeURIComponent(milestoneId)}?today=${encodeURIComponent(today)}`;
        return readJson(await send(url, 'PATCH', draft), 'Could not save the milestone.');
    },

    /** Deletes the milestone and its project; the project's tasks stay, unassigned. */
    async deleteMilestone(pathId: string, milestoneId: string): Promise<void> {
        const response = await apiFetch(`${PATHS_URL}/${encodeURIComponent(pathId)}/milestones/${encodeURIComponent(milestoneId)}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Could not delete the milestone.');
    },

    async createCheckpoint(projectId: string, draft: CheckpointDraft, today: string): Promise<Checkpoint> {
        return readJson(await send(checkpointsUrl(projectId, null, today), 'POST', draft), 'Could not add the checkpoint.');
    },

    async updateCheckpoint(projectId: string, checkpointId: string, draft: CheckpointDraft, today: string): Promise<Checkpoint> {
        return readJson(await send(checkpointsUrl(projectId, checkpointId, today), 'PATCH', draft), 'Could not save the checkpoint.');
    },

    /** Deletes the checkpoint; its tasks stay in the project without one. */
    async deleteCheckpoint(projectId: string, checkpointId: string): Promise<void> {
        const response = await apiFetch(checkpointsUrl(projectId, checkpointId, null), {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Could not delete the checkpoint.');
    },

    async previewSignal(signal: SignalDraft, today: string): Promise<SignalPreview> {
        const url = `${PATHS_URL}/signal-preview?today=${encodeURIComponent(today)}`;
        return readJson(await send(url, 'POST', signal), 'Could not preview the signal.');
    },
};

import { MeditationSession, StartMeditationRequest } from '../../types/MeditationSession';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const MEDITATION_URL = `${API_BASE_URL}/api/v1/meditation`;

function jsonHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json; charset=UTF-8',
        ...getAuthHeaders(),
    };
}

export const meditationService = {
    async getActiveSession(): Promise<MeditationSession | null> {
        const response = await fetch(`${MEDITATION_URL}/active`, {
            headers: getAuthHeaders(),
        });

        if (response.status === 204) return null;
        if (!response.ok) throw new Error('Failed to restore meditation session');
        return response.json();
    },

    async startSession(request: StartMeditationRequest): Promise<MeditationSession> {
        const response = await fetch(`${MEDITATION_URL}/start`, {
            method: 'POST',
            body: JSON.stringify(request),
            headers: jsonHeaders(),
        });

        if (!response.ok) throw new Error('Failed to start meditation session');
        return response.json();
    },

    async pauseSession(sessionId: string): Promise<MeditationSession> {
        return updateSession(`${sessionId}/pause`, 'Failed to pause meditation session');
    },

    async unpauseSession(sessionId: string): Promise<MeditationSession> {
        return updateSession(`${sessionId}/unpause`, 'Failed to resume meditation session');
    },

    async endSession(sessionId: string, moodAfter?: number): Promise<MeditationSession> {
        const response = await fetch(`${MEDITATION_URL}/${sessionId}/end`, {
            method: 'POST',
            body: moodAfter === undefined ? undefined : JSON.stringify({ moodAfter }),
            headers: moodAfter === undefined ? getAuthHeaders() : jsonHeaders(),
        });

        if (!response.ok) throw new Error('Failed to finish meditation session');
        return response.json();
    },
};

async function updateSession(path: string, errorMessage: string): Promise<MeditationSession> {
    const response = await fetch(`${MEDITATION_URL}/${path}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error(errorMessage);
    return response.json();
}

import {
    CloseMentalThreadInput,
    MentalThread,
    MentalThreadInput,
    MentalThreadLoadEntry,
    MentalThreadSummary,
} from '../../types/MentalThread.ts';
import { getAuthHeaders } from '../utils/authHeaders.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const MENTAL_THREADS_URL = `${API_BASE_URL}/api/v1/mental-threads`;

function jsonHeaders() {
    return {
        'Content-Type': 'application/json; charset=UTF-8',
        ...getAuthHeaders(),
    };
}

async function responseJson<T>(response: Response, fallbackMessage: string): Promise<T> {
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || fallbackMessage);
    }
    return response.json() as Promise<T>;
}

export const mentalThreadService = {
    async getThreads(includeClosed = false, signal?: AbortSignal): Promise<MentalThread[]> {
        const response = await fetch(`${MENTAL_THREADS_URL}?includeClosed=${includeClosed}`, {
            headers: getAuthHeaders(),
            signal,
        });
        return responseJson(response, 'Failed to load mental threads');
    },

    async getSummary(signal?: AbortSignal): Promise<MentalThreadSummary> {
        const response = await fetch(`${MENTAL_THREADS_URL}/summary`, {
            headers: getAuthHeaders(),
            signal,
        });
        return responseJson(response, 'Failed to load the mental load summary');
    },

    async createThread(input: MentalThreadInput): Promise<MentalThread> {
        const response = await fetch(MENTAL_THREADS_URL, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        return responseJson(response, 'Failed to create the mental thread');
    },

    async updateThread(threadId: string, input: MentalThreadInput): Promise<MentalThread> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}`, {
            method: 'PUT',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        return responseJson(response, 'Failed to update the mental thread');
    },

    async closeThread(threadId: string, input: CloseMentalThreadInput): Promise<MentalThread> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}/close`, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        return responseJson(response, 'Failed to close the mental thread');
    },

    async reopenThread(threadId: string): Promise<MentalThread> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}/reopen`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return responseJson(response, 'Failed to reopen the mental thread');
    },

    async deleteThread(threadId: string): Promise<void> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete the mental thread');
    },

    async getLoadHistory(threadId: string, signal?: AbortSignal): Promise<MentalThreadLoadEntry[]> {
        const response = await fetch(`${MENTAL_THREADS_URL}/${threadId}/load-history`, {
            headers: getAuthHeaders(),
            signal,
        });
        return responseJson(response, 'Failed to load mental load history');
    },

    async checkInCapacity(capacity: number): Promise<void> {
        const response = await fetch(`${MENTAL_THREADS_URL}/capacity/today`, {
            method: 'PUT',
            headers: jsonHeaders(),
            body: JSON.stringify({ capacity }),
        });
        if (!response.ok) throw new Error('Failed to save today\'s capacity');
    },
};

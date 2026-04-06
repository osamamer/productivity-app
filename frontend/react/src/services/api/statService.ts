import { StatDefinition, StatEntry, StatSummary, CreateDefinitionRequest, RecordEntryRequest } from '../../types/Stats';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const STATS_URL = `${API_BASE_URL}/api/v1/stats`;

export const statService = {
    async getDefinitions(): Promise<StatDefinition[]> {
        const response = await fetch(`${STATS_URL}/definitions`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to fetch stat definitions');
        return response.json();
    },

    async createDefinition(req: CreateDefinitionRequest): Promise<StatDefinition> {
        const response = await fetch(`${STATS_URL}/definitions`, {
            method: 'POST',
            body: JSON.stringify(req),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to create stat definition');
        return response.json();
    },

    async deleteDefinition(id: string): Promise<void> {
        const response = await fetch(`${STATS_URL}/definitions/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete stat definition');
    },

    async getEntries(definitionId: string, from: string, to: string): Promise<StatEntry[]> {
        const params = new URLSearchParams({ statDefinitionId: definitionId, from, to });
        const response = await fetch(`${STATS_URL}/entries?${params}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to fetch stat entries');
        return response.json();
    },

    async getTodayEntries(): Promise<StatEntry[]> {
        const response = await fetch(`${STATS_URL}/entries/today`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error("Failed to fetch today's entries");
        return response.json();
    },

    async getSummary(definitionId: string): Promise<StatSummary> {
        const response = await fetch(`${STATS_URL}/definitions/${definitionId}/summary`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch stat summary');
        return response.json();
    },

    async getEntriesByDate(date: string): Promise<StatEntry[]> {
        const response = await fetch(`${STATS_URL}/entries/by-date?date=${date}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error(`Failed to fetch entries for ${date}`);
        return response.json();
    },

    async recordEntry(req: RecordEntryRequest): Promise<StatEntry> {
        const response = await fetch(`${STATS_URL}/entries`, {
            method: 'POST',
            body: JSON.stringify(req),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to record stat entry');
        return response.json();
    },
};

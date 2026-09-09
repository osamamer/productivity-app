import {
    DayTemplate,
    DayTemplateApplication,
    DayTemplateRequest,
} from '../../types/DayTemplate';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const TEMPLATE_URL = `${API_BASE_URL}/api/v1/day-templates`;

async function ensureSuccessful(response: Response, fallback: string): Promise<void> {
    if (!response.ok) throw new Error(fallback);
}

export const dayTemplateService = {
    async getTemplates(): Promise<DayTemplate[]> {
        const response = await fetch(TEMPLATE_URL, { headers: getAuthHeaders() });
        await ensureSuccessful(response, 'Unable to load day templates.');
        return response.json();
    },

    async createTemplate(request: DayTemplateRequest): Promise<DayTemplate> {
        const response = await fetch(TEMPLATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(request),
        });
        await ensureSuccessful(response, 'Unable to save the day template.');
        return response.json();
    },

    async applyTemplate(templateId: string, date: string): Promise<DayTemplateApplication> {
        const response = await fetch(`${TEMPLATE_URL}/${templateId}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ date }),
        });
        await ensureSuccessful(response, 'Unable to apply the day template.');
        return response.json();
    },
};

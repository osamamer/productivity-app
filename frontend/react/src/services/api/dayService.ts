// src/services/api/dayService.ts
import { DayEntity } from '../../types/DayEntity';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const DAY_URL = `${API_BASE_URL}/api/v1/day`;

export const dayService = {

    async getToday(): Promise<DayEntity> {
        const response = await fetch(`${DAY_URL}/get-today`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch today');
        }
        return response.json();
    },

    async setTodayInfo(rating: number, plan: string, summary: string): Promise<void> {
        const response = await fetch(`${DAY_URL}/set-today-info`, {
            method: 'POST',
            body: JSON.stringify({
                dayRating: rating,
                dayPlan: plan,
                daySummary: summary,
            }),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...getAuthHeaders(),
            },
        });
        if (!response.ok) {
            throw new Error('Failed to update today info');
        }
    },
};

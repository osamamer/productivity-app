import { MentalStateCheckIn, MentalStateCheckInRequest } from '../../types/MentalState';
import { getAuthHeaders } from '../utils/authHeaders';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const MENTAL_STATE_URL = `${API_BASE_URL}/api/v1/mental-state/check-ins`;

export const mentalStateService = {
    async getHistory(limit = 30): Promise<MentalStateCheckIn[]> {
        const response = await fetch(`${MENTAL_STATE_URL}?limit=${limit}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch mental state history');
        return response.json();
    },

    async checkIn(request: MentalStateCheckInRequest): Promise<MentalStateCheckIn> {
        const response = await fetch(MENTAL_STATE_URL, {
            method: 'POST',
            body: JSON.stringify(request),
            headers: { 'Content-Type': 'application/json; charset=UTF-8', ...getAuthHeaders() },
        });
        if (!response.ok) throw new Error('Failed to record mental state check-in');
        return response.json();
    },
};

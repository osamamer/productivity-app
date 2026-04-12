import axios from 'axios';
import apiClient from '../utils/axiosConfig';

const API_BASE_URL = 'http://localhost:8080/api/v1';

export const userService = {
    async createUser(userData: {
        email: string;
        firstName: string;
        lastName: string;
        username: string;
        keycloakId?: string | null;
    }) {
        const response = await axios.post(`${API_BASE_URL}/users`, userData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    },

    async getUserById(userId: string) {
        const response = await axios.get(`${API_BASE_URL}/users/${userId}`);
        return response.data;
    },

    async getUserByEmail(email: string) {
        const response = await axios.get(`${API_BASE_URL}/users/email/${email}`);
        return response.data;
    },

    async getUserByUsername(username: string) {
        const response = await axios.get(`${API_BASE_URL}/users/username/${username}`);
        return response.data;
    },

    async getAllUsers() {
        const response = await axios.get(`${API_BASE_URL}/users`);
        return response.data;
    },

    async updateUser(userId: string, userData: {
        email?: string;
        firstName?: string;
        lastName?: string;
        username?: string;
    }) {
        const response = await axios.put(`${API_BASE_URL}/users/${userId}`, userData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    },

    async deactivateUser(userId: string) {
        const response = await axios.patch(`${API_BASE_URL}/users/${userId}/deactivate`);
        return response.data;
    },

    async activateUser(userId: string) {
        const response = await axios.patch(`${API_BASE_URL}/users/${userId}/activate`);
        return response.data;
    },

    async deleteUser(userId: string) {
        await axios.delete(`${API_BASE_URL}/users/${userId}`);
    },

    async changePassword(passwords: {
        currentPassword: string;
        newPassword: string;
    }) {
        await apiClient.put('/api/v1/users/me/password', passwords);
    },
};

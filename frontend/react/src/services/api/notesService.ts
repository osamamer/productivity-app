import { Note, NoteCategory } from '../../types/Note.ts';
import { getAuthHeaders } from '../utils/authHeaders.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const NOTES_URL = `${API_BASE_URL}/api/v1/notes`;
const CATEGORIES_URL = `${API_BASE_URL}/api/v1/note-categories`;

export type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'categoryId' | 'pinned'>>;
export type CategoryInput = Pick<NoteCategory, 'name' | 'color'>;

function jsonHeaders() {
    return {
        'Content-Type': 'application/json; charset=UTF-8',
        ...getAuthHeaders(),
    };
}

async function responseJson<T>(response: Response, errorMessage: string): Promise<T> {
    if (!response.ok) throw new Error(errorMessage);
    return response.json() as Promise<T>;
}

export const notesService = {
    async getNotes(signal?: AbortSignal): Promise<Note[]> {
        const response = await fetch(NOTES_URL, { headers: getAuthHeaders(), signal });
        return responseJson(response, 'Failed to load notes');
    },

    async createNote(categoryId: string | null): Promise<Note> {
        const response = await fetch(NOTES_URL, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ title: 'Untitled', content: '', categoryId, pinned: false }),
        });
        return responseJson(response, 'Failed to create note');
    },

    async updateNote(noteId: string, updates: NotePatch, keepalive = false): Promise<Note> {
        const response = await fetch(`${NOTES_URL}/${noteId}`, {
            method: 'PATCH',
            headers: jsonHeaders(),
            body: JSON.stringify(updates),
            keepalive,
        });
        return responseJson(response, 'Failed to save note');
    },

    async deleteNote(noteId: string): Promise<void> {
        const response = await fetch(`${NOTES_URL}/${noteId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete note');
    },

    async getCategories(signal?: AbortSignal): Promise<NoteCategory[]> {
        const response = await fetch(CATEGORIES_URL, { headers: getAuthHeaders(), signal });
        return responseJson(response, 'Failed to load note categories');
    },

    async createCategory(input: CategoryInput): Promise<NoteCategory> {
        const response = await fetch(CATEGORIES_URL, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        return responseJson(response, 'Failed to create category');
    },

    async updateCategory(categoryId: string, input: CategoryInput): Promise<NoteCategory> {
        const response = await fetch(`${CATEGORIES_URL}/${categoryId}`, {
            method: 'PATCH',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        return responseJson(response, 'Failed to update category');
    },

    async deleteCategory(categoryId: string): Promise<void> {
        const response = await fetch(`${CATEGORIES_URL}/${categoryId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete category');
    },
};

import { Note, NoteCategory } from '../../types/Note';
import { TtlCache } from './ttlCache';

export interface NotesWorkspaceSnapshot {
    notes: Note[];
    categories: NoteCategory[];
}

const cache = new TtlCache<NotesWorkspaceSnapshot>({ ttlMs: 24 * 60 * 60 * 1000, maxEntries: 4 });

export const notesWorkspaceCache = {
    get(userId: string): NotesWorkspaceSnapshot | undefined {
        return cache.getStale(userId);
    },
    set(userId: string, snapshot: NotesWorkspaceSnapshot): void {
        cache.set(userId, snapshot);
    },
    invalidate(userId: string): void {
        cache.delete(userId);
    },
    clear(): void {
        cache.clear();
    },
};

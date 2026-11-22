export interface PlacedFocusNote {
    id: number;
    x: number;
    y: number;
    text: string;
}

const notesBySession = new Map<string, PlacedFocusNote[]>();
const storagePrefix = 'claritard.focusNotes.';
const maxSessions = 5;

export function focusNotesForSession(sessionId: string): PlacedFocusNote[] {
    const cached = notesBySession.get(sessionId);
    if (cached) return cached;

    try {
        return JSON.parse(sessionStorage.getItem(storagePrefix + sessionId) ?? '[]') as PlacedFocusNote[];
    } catch (error) {
        console.warn('Could not restore focus notes:', error);
        return [];
    }
}

export function rememberFocusNotes(sessionId: string, notes: PlacedFocusNote[]): void {
    notesBySession.delete(sessionId);
    notesBySession.set(sessionId, notes);
    try {
        const key = storagePrefix + sessionId;
        sessionStorage.removeItem(key);
        if (notes.some(note => note.text.trim())) {
            sessionStorage.setItem(key, JSON.stringify(notes.filter(note => note.text.trim())));
        }
        const keys = Object.keys(sessionStorage).filter(item => item.startsWith(storagePrefix));
        keys.slice(0, Math.max(0, keys.length - maxSessions)).forEach(item => sessionStorage.removeItem(item));
    } catch (error) {
        console.warn('Could not store focus notes:', error);
    }
    if (notesBySession.size > maxSessions) {
        const oldest = notesBySession.keys().next().value;
        if (oldest !== undefined) notesBySession.delete(oldest);
    }
}

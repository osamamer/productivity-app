export interface PlacedFocusNote {
    id: number;
    x: number;
    y: number;
    text: string;
    savedText: string;
    noteId: Promise<string> | null;
    pendingSave: Promise<void>;
}

const notesBySession = new Map<string, PlacedFocusNote[]>();

export function focusNotesForSession(sessionId: string): PlacedFocusNote[] {
    return notesBySession.get(sessionId) ?? [];
}

export function rememberFocusNotes(sessionId: string, notes: PlacedFocusNote[]): void {
    notesBySession.delete(sessionId);
    notesBySession.set(sessionId, notes);
    // Focus notes are also saved as regular notes. Keep only recent on-screen positions in memory.
    while (notesBySession.size > 5) {
        const oldest = notesBySession.keys().next().value;
        if (oldest === undefined) break;
        notesBySession.delete(oldest);
    }
}

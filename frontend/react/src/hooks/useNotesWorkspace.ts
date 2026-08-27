import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notesService, NotePatch } from '../services/api/notesService.ts';
import { Note, NoteCategory } from '../types/Note.ts';

const SAVE_DELAY_MS = 500;
interface WorkspaceState {
    notes: Note[];
    categories: NoteCategory[];
}

const EMPTY_WORKSPACE: WorkspaceState = { notes: [], categories: [] };

function errorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export function useNotesWorkspace(userId: string) {
    const [workspace, setWorkspace] = useState<WorkspaceState>(EMPTY_WORKSPACE);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [operationError, setOperationError] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
    const selectedNoteIdRef = useRef<string | null>(null);
    const pendingUpdatesRef = useRef(new Map<string, NotePatch>());
    const failedUpdatesRef = useRef(new Map<string, NotePatch>());
    const saveTimersRef = useRef(new Map<string, number>());
    const inFlightSavesByNoteRef = useRef(new Map<string, Promise<void>>());
    const inFlightSavesRef = useRef(0);
    const mountedRef = useRef(true);
    const loadVersionRef = useRef(0);

    const reload = useCallback(async () => {
        const loadVersion = loadVersionRef.current + 1;
        loadVersionRef.current = loadVersion;
        setLoading(true);
        setLoadError(null);
        try {
            const [notes, categories] = await Promise.all([
                notesService.getNotes(),
                notesService.getCategories(),
            ]);
            if (!mountedRef.current || loadVersion !== loadVersionRef.current) return;
            setWorkspace({ notes, categories });
            setSelectedNoteId(current => notes.some(note => note.id === current) ? current : notes[0]?.id ?? null);
        } catch (error) {
            if (mountedRef.current && loadVersion === loadVersionRef.current) {
                setLoadError(errorMessage(error, 'Could not load notes.'));
            }
        } finally {
            if (mountedRef.current && loadVersion === loadVersionRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!userId) return;
        mountedRef.current = true;
        void reload();
    }, [reload, userId]);

    const updateSaveState = useCallback(() => {
        if (!mountedRef.current) return;
        if (failedUpdatesRef.current.size > 0) {
            setSaveState('error');
        } else if (pendingUpdatesRef.current.size > 0 || inFlightSavesRef.current > 0) {
            setSaveState('saving');
        } else {
            setSaveState('saved');
        }
    }, []);

    const flushNote = useCallback(async (noteId: string, keepalive = false) => {
        const existingSave = inFlightSavesByNoteRef.current.get(noteId);
        if (existingSave) await existingSave;

        const timer = saveTimersRef.current.get(noteId);
        if (timer !== undefined) window.clearTimeout(timer);
        saveTimersRef.current.delete(noteId);

        const updates = pendingUpdatesRef.current.get(noteId);
        if (!updates) return;
        pendingUpdatesRef.current.delete(noteId);
        const saveRequest = (async () => {
            inFlightSavesRef.current += 1;
            updateSaveState();
            try {
                const savedNote = await notesService.updateNote(noteId, updates, keepalive);
                const newerUpdates = pendingUpdatesRef.current.get(noteId);
                if (mountedRef.current) {
                    setWorkspace(current => ({
                        ...current,
                        notes: current.notes.map(note => note.id === noteId
                            ? { ...note, updatedAt: newerUpdates ? note.updatedAt : savedNote.updatedAt }
                            : note),
                    }));
                }
            } catch (error) {
                const newerUpdates = pendingUpdatesRef.current.get(noteId);
                const pendingTimer = saveTimersRef.current.get(noteId);
                if (pendingTimer !== undefined) window.clearTimeout(pendingTimer);
                saveTimersRef.current.delete(noteId);
                pendingUpdatesRef.current.delete(noteId);
                failedUpdatesRef.current.set(noteId, {
                    ...failedUpdatesRef.current.get(noteId),
                    ...updates,
                    ...newerUpdates,
                });
                console.error(`Could not save note ${noteId}.`, error);
            } finally {
                inFlightSavesRef.current -= 1;
                updateSaveState();
            }
        })();

        inFlightSavesByNoteRef.current.set(noteId, saveRequest);
        try {
            await saveRequest;
        } finally {
            if (inFlightSavesByNoteRef.current.get(noteId) === saveRequest) {
                inFlightSavesByNoteRef.current.delete(noteId);
            }
        }
    }, [updateSaveState]);

    const queueNoteSave = useCallback((noteId: string, updates: NotePatch) => {
        const retryUpdates = failedUpdatesRef.current.get(noteId);
        failedUpdatesRef.current.delete(noteId);
        pendingUpdatesRef.current.set(noteId, {
            ...retryUpdates,
            ...pendingUpdatesRef.current.get(noteId),
            ...updates,
        });

        const currentTimer = saveTimersRef.current.get(noteId);
        if (currentTimer !== undefined) window.clearTimeout(currentTimer);
        saveTimersRef.current.set(noteId, window.setTimeout(() => {
            void flushNote(noteId);
        }, SAVE_DELAY_MS));
        updateSaveState();
    }, [flushNote, updateSaveState]);

    useEffect(() => () => {
        mountedRef.current = false;
        for (const timer of saveTimersRef.current.values()) window.clearTimeout(timer);
        for (const [noteId, updates] of pendingUpdatesRef.current.entries()) {
            void notesService.updateNote(noteId, updates, true).catch(error => {
                console.error(`Could not flush note ${noteId} before leaving.`, error);
            });
        }
        saveTimersRef.current.clear();
        pendingUpdatesRef.current.clear();
    }, []);

    useEffect(() => {
        selectedNoteIdRef.current = selectedNoteId;
    }, [selectedNoteId]);

    const selectedNote = useMemo(
        () => workspace.notes.find(note => note.id === selectedNoteId) ?? null,
        [selectedNoteId, workspace.notes],
    );

    const selectNote = useCallback((noteId: string | null) => {
        const currentNoteId = selectedNoteIdRef.current;
        if (currentNoteId && currentNoteId !== noteId) void flushNote(currentNoteId);
        setSelectedNoteId(noteId);
    }, [flushNote]);

    const createNote = useCallback(async (categoryId: string | null = null) => {
        setOperationError(null);
        try {
            const note = await notesService.createNote(categoryId);
            setWorkspace(current => ({ ...current, notes: [note, ...current.notes] }));
            setSelectedNoteId(note.id);
            return note.id;
        } catch (error) {
            setOperationError(errorMessage(error, 'Could not create note.'));
            return null;
        }
    }, []);

    const updateNote = useCallback((noteId: string, updates: NotePatch) => {
        setWorkspace(current => ({
            ...current,
            notes: current.notes.map(note => note.id === noteId
                ? { ...note, ...updates }
                : note),
        }));
        queueNoteSave(noteId, updates);
    }, [queueNoteSave]);

    const updateNoteDraft = useCallback((noteId: string, updates: NotePatch) => {
        queueNoteSave(noteId, updates);
    }, [queueNoteSave]);

    const commitNoteDraft = useCallback((noteId: string, updates: NotePatch) => {
        setWorkspace(current => ({
            ...current,
            notes: current.notes.map(note => note.id === noteId
                ? { ...note, ...updates }
                : note),
        }));
    }, []);

    const deleteNote = useCallback(async (noteId: string) => {
        setOperationError(null);
        try {
            await flushNote(noteId);
            await notesService.deleteNote(noteId);
            const timer = saveTimersRef.current.get(noteId);
            if (timer !== undefined) window.clearTimeout(timer);
            saveTimersRef.current.delete(noteId);
            pendingUpdatesRef.current.delete(noteId);
            failedUpdatesRef.current.delete(noteId);
            setWorkspace(current => ({ ...current, notes: current.notes.filter(note => note.id !== noteId) }));
            setSelectedNoteId(current => current === noteId ? null : current);
            updateSaveState();
        } catch (error) {
            setOperationError(errorMessage(error, 'Could not delete note.'));
        }
    }, [flushNote, updateSaveState]);

    const createCategory = useCallback(async (name: string, color: string) => {
        setOperationError(null);
        try {
            const category = await notesService.createCategory({ name: name.trim(), color });
            setWorkspace(current => ({ ...current, categories: [...current.categories, category] }));
            return category.id;
        } catch (error) {
            setOperationError(errorMessage(error, 'Could not create category.'));
            return null;
        }
    }, []);

    const updateCategory = useCallback(async (categoryId: string, updates: Pick<NoteCategory, 'name' | 'color'>) => {
        setOperationError(null);
        try {
            const category = await notesService.updateCategory(categoryId, { ...updates, name: updates.name.trim() });
            setWorkspace(current => ({
                ...current,
                categories: current.categories.map(existing => existing.id === categoryId ? category : existing),
            }));
            return true;
        } catch (error) {
            setOperationError(errorMessage(error, 'Could not update category.'));
            return false;
        }
    }, []);

    const deleteCategory = useCallback(async (categoryId: string) => {
        setOperationError(null);
        try {
            await notesService.deleteCategory(categoryId);
            setWorkspace(current => ({
                ...current,
                categories: current.categories.filter(category => category.id !== categoryId),
                notes: current.notes.map(note => note.categoryId === categoryId
                    ? { ...note, categoryId: null }
                    : note),
            }));
            return true;
        } catch (error) {
            setOperationError(errorMessage(error, 'Could not delete category.'));
            return false;
        }
    }, []);

    const retryFailedSaves = useCallback(() => {
        for (const [noteId, updates] of failedUpdatesRef.current.entries()) {
            failedUpdatesRef.current.delete(noteId);
            pendingUpdatesRef.current.set(noteId, {
                ...updates,
                ...pendingUpdatesRef.current.get(noteId),
            });
            void flushNote(noteId);
        }
    }, [flushNote]);

    return {
        notes: workspace.notes,
        categories: workspace.categories,
        selectedNote,
        selectedNoteId,
        loading,
        loadError,
        operationError,
        saveState,
        reload,
        clearOperationError: () => setOperationError(null),
        retryFailedSaves,
        selectNote,
        createNote,
        updateNote,
        updateNoteDraft,
        commitNoteDraft,
        deleteNote,
        createCategory,
        updateCategory,
        deleteCategory,
    };
}

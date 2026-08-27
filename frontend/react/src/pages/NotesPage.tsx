import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { PageWrapper } from '../components/PageWrapper.tsx';
import { NotesFilter, NotesSidebar } from '../components/notes/NotesSidebar.tsx';
import { NotesList } from '../components/notes/NotesList.tsx';
import { NoteEditor } from '../components/notes/NoteEditor.tsx';
import { CategoryDialog } from '../components/notes/CategoryDialog.tsx';
import { useNotesWorkspace } from '../hooks/useNotesWorkspace.ts';
import { useUser } from '../contexts/UserContext.tsx';
import { NoteCategory, NoteSort } from '../types/Note.ts';

export function NotesPage() {
    const { user } = useUser();
    const {
        notes,
        categories,
        selectedNote,
        selectedNoteId,
        loading,
        loadError,
        operationError,
        saveState,
        reload,
        clearOperationError,
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
    } = useNotesWorkspace(user?.id ?? 'anonymous');
    const [activeFilter, setActiveFilter] = useState<NotesFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sort, setSort] = useState<NoteSort>('updated');
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<NoteCategory | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<NoteCategory | null>(null);
    const [noteDeleteDialogOpen, setNoteDeleteDialogOpen] = useState(false);
    const [focusMode, setFocusMode] = useState(false);

    const noteCounts = useMemo(() => {
        const counts: Record<string, number> = {
            all: notes.length,
            pinned: notes.filter(note => note.pinned).length,
            uncategorized: notes.filter(note => note.categoryId === null).length,
        };
        for (const category of categories) {
            counts[category.id] = notes.filter(note => note.categoryId === category.id).length;
        }
        return counts;
    }, [categories, notes]);

    const visibleNotes = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
        const filtered = notes.filter(note => {
            if (activeFilter === 'pinned' && !note.pinned) return false;
            if (activeFilter === 'uncategorized' && note.categoryId !== null) return false;
            if (!['all', 'pinned', 'uncategorized'].includes(activeFilter) && note.categoryId !== activeFilter) return false;
            if (!normalizedQuery) return true;

            const searchableContent = note.content.replace(/<[^>]*>/g, ' ');
            return `${note.title} ${searchableContent}`.toLocaleLowerCase().includes(normalizedQuery);
        });

        return [...filtered].sort((left, right) => {
            if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
            if (sort === 'title') return left.title.localeCompare(right.title);
            const leftDate = new Date(sort === 'created' ? left.createdAt : left.updatedAt).getTime();
            const rightDate = new Date(sort === 'created' ? right.createdAt : right.updatedAt).getTime();
            return rightDate - leftDate;
        });
    }, [activeFilter, notes, searchQuery, sort]);

    useEffect(() => {
        if (!visibleNotes.some(note => note.id === selectedNoteId)) {
            selectNote(visibleNotes[0]?.id ?? null);
        }
    }, [selectNote, selectedNoteId, visibleNotes]);

    useEffect(() => {
        if (!selectedNote) setFocusMode(false);
    }, [selectedNote]);

    useEffect(() => {
        if (!focusMode) return;

        const exitFocusMode = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setFocusMode(false);
        };
        window.addEventListener('keydown', exitFocusMode);
        return () => window.removeEventListener('keydown', exitFocusMode);
    }, [focusMode]);

    useEffect(() => {
        function handleKeyboardShortcut(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
                event.preventDefault();
                if (loading || loadError) return;
                const categoryId = categories.some(category => category.id === activeFilter) ? activeFilter : null;
                void createNote(categoryId);
            }
        }

        window.addEventListener('keydown', handleKeyboardShortcut);
        return () => window.removeEventListener('keydown', handleKeyboardShortcut);
    }, [activeFilter, categories, createNote, loadError, loading]);

    function handleCreateNote() {
        if (loading || loadError) return;
        const categoryId = categories.some(category => category.id === activeFilter) ? activeFilter : null;
        void createNote(categoryId);
    }

    async function handleCategorySave(name: string, color: string) {
        if (editingCategory) {
            return updateCategory(editingCategory.id, { name, color });
        }

        const categoryId = await createCategory(name, color);
        if (categoryId) {
            setActiveFilter(categoryId);
            return true;
        }
        return false;
    }

    return (
        <PageWrapper hideNavigation={focusMode} flush={focusMode}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                {!focusMode && <Box sx={{
                    minHeight: 64,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: { xs: 1, md: 2 },
                    pb: 2,
                }}>
                    <Box sx={{ textAlign: 'left', flex: 1 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.025em' }}>
                            Notes
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Your quiet place to capture and connect ideas
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        onClick={handleCreateNote}
                        disabled={loading || Boolean(loadError)}
                        sx={{ borderRadius: 2.5, px: 2, textTransform: 'none', boxShadow: 'none' }}
                    >
                        New note
                    </Button>
                </Box>}

                <Box sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    overflow: 'hidden',
                    border: focusMode ? 0 : theme => `1px solid ${theme.palette.divider}`,
                    borderRadius: focusMode ? 0 : 3.5,
                    backgroundColor: 'background.paper',
                    boxShadow: focusMode ? 'none' : '0 12px 40px rgba(30, 24, 50, 0.06)',
                }}>
                    {loading ? (
                        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                            <CircularProgress size={32} />
                        </Box>
                    ) : loadError ? (
                        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3 }}>
                            <Alert
                                severity="error"
                                action={<Button color="inherit" size="small" onClick={() => void reload()}>Retry</Button>}
                            >
                                {loadError}
                            </Alert>
                        </Box>
                    ) : (<>
                    {!focusMode && <NotesSidebar
                        key="notes-sidebar"
                        categories={categories}
                        activeFilter={activeFilter}
                        noteCounts={noteCounts}
                        onFilterChange={setActiveFilter}
                        onAddCategory={() => {
                            setEditingCategory(null);
                            setCategoryDialogOpen(true);
                        }}
                        onEditCategory={category => {
                            setEditingCategory(category);
                            setCategoryDialogOpen(true);
                        }}
                        onDeleteCategory={setCategoryToDelete}
                    />}
                    {!focusMode && <NotesList
                        key="notes-list"
                        notes={visibleNotes}
                        categories={categories}
                        selectedNoteId={selectedNoteId}
                        searchQuery={searchQuery}
                        sort={sort}
                        onSearchChange={setSearchQuery}
                        onSortChange={setSort}
                        onSelectNote={selectNote}
                    />}
                    {selectedNote ? (
                        <NoteEditor
                            key={selectedNote.id}
                            note={selectedNote}
                            categories={categories}
                            saveState={saveState}
                            onUpdate={updates => updateNote(selectedNote.id, updates)}
                            onDraftUpdate={updates => updateNoteDraft(selectedNote.id, updates)}
                            onCommitDraft={updates => commitNoteDraft(selectedNote.id, updates)}
                            onDelete={() => setNoteDeleteDialogOpen(true)}
                            onRetrySave={retryFailedSaves}
                            focusMode={focusMode}
                            onToggleFocusMode={() => setFocusMode(current => !current)}
                        />
                    ) : (
                        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 4 }}>
                            <Box sx={{ maxWidth: 360, textAlign: 'center' }}>
                                <EditNoteRoundedIcon color="primary" sx={{ fontSize: 48, mb: 1.5, opacity: 0.8 }} />
                                <Typography variant="h5" sx={{ mb: 1, fontWeight: 650 }}>
                                    Start with a thought
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                                    Create a note, organize it into a category, and shape it with headings, lists, quotes, links, and code blocks.
                                </Typography>
                                <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={handleCreateNote} sx={{ textTransform: 'none' }}>
                                    Create your first note
                                </Button>
                            </Box>
                        </Box>
                    )}
                    </>)}
                </Box>
            </Box>

            <CategoryDialog
                open={categoryDialogOpen}
                category={editingCategory}
                onClose={() => setCategoryDialogOpen(false)}
                onSave={handleCategorySave}
            />

            <Dialog open={noteDeleteDialogOpen} onClose={() => setNoteDeleteDialogOpen(false)}>
                <DialogTitle>Delete this note?</DialogTitle>
                <DialogContent>
                    <DialogContentText>This cannot be undone.</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNoteDeleteDialogOpen(false)}>Cancel</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            if (selectedNote) void deleteNote(selectedNote.id);
                            setNoteDeleteDialogOpen(false);
                        }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(categoryToDelete)} onClose={() => setCategoryToDelete(null)}>
                <DialogTitle>Delete “{categoryToDelete?.name}”?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Notes in this category will be kept and moved to Uncategorized.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCategoryToDelete(null)}>Cancel</Button>
                    <Button
                        color="error"
                        onClick={async () => {
                            if (categoryToDelete) {
                                const deleted = await deleteCategory(categoryToDelete.id);
                                if (deleted && activeFilter === categoryToDelete.id) setActiveFilter('uncategorized');
                            }
                            setCategoryToDelete(null);
                        }}
                    >
                        Delete category
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(operationError)} autoHideDuration={5000} onClose={clearOperationError}>
                <Alert severity="error" onClose={clearOperationError} variant="filled">
                    {operationError}
                </Alert>
            </Snackbar>
        </PageWrapper>
    );
}

import { CompactPopover } from '../components/CompactPopover';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert, Box, Button, CircularProgress,
    ClickAwayListener, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Divider, ListItemIcon, ListItemText,
    Menu, MenuItem, Popover, Snackbar,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import { PageWrapper } from '../components/PageWrapper.tsx';
import { NotesFilter, NotesSidebar } from '../components/notes/NotesSidebar.tsx';
import { NotesList } from '../components/notes/NotesList.tsx';
import { NoteEditor } from '../components/notes/NoteEditor.tsx';
import { CategoryDialog } from '../components/notes/CategoryDialog.tsx';
import { useNotesWorkspace } from '../hooks/useNotesWorkspace.ts';
import { useKeyboardDelete } from '../hooks/useKeyboardDelete';
import { useUser } from '../hooks/useUser';
import { Note, NoteCategory, NoteSort } from '../types/Note.ts';

interface NoteContextMenuState {
    note: Note;
    top: number;
    left: number;
}

interface NoteDeleteAnchorPosition {
    top: number;
    left: number;
}

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
        deleteNote,
        updateNotes,
        deleteNotes,
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
    const [categoryDeleteAnchorPosition, setCategoryDeleteAnchorPosition] = useState<{ top: number; left: number } | null>(null);
    const [noteDeleteTarget, setNoteDeleteTarget] = useState<Note | null>(null);
    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const selectionAnchorIdRef = useRef<string | null>(null);
    const [focusMode, setFocusMode] = useState(false);
    const [noteIdToFocus, setNoteIdToFocus] = useState<string | null>(null);
    const [noteContextMenu, setNoteContextMenu] = useState<NoteContextMenuState | null>(null);
    const [noteCategoryMenu, setNoteCategoryMenu] = useState<NoteContextMenuState | null>(null);
    const [noteDeleteAnchorEl, setNoteDeleteAnchorEl] = useState<HTMLElement | null>(null);
    const [noteDeleteAnchorPosition, setNoteDeleteAnchorPosition] = useState<NoteDeleteAnchorPosition | null>(null);

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
        const visibleIds = new Set(visibleNotes.map(note => note.id));
        setSelectedNoteIds(current => current.filter(noteId => visibleIds.has(noteId)));
    }, [visibleNotes]);

    const clearNoteTitleFocus = useCallback(() => setNoteIdToFocus(null), []);
    const createNoteAndFocusTitle = useCallback(async (categoryId: string | null) => {
        if (loading || loadError) return;
        const noteId = await createNote(categoryId);
        if (noteId) setNoteIdToFocus(noteId);
    }, [createNote, loadError, loading]);

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

    useKeyboardDelete({
        enabled: Boolean(selectedNote) && !noteDeleteTarget && !bulkDeleteDialogOpen
            && !categoryToDelete && !categoryDialogOpen,
        onDelete: () => requestKeyboardNoteDelete(),
    });

    useEffect(() => {
        function handleKeyboardShortcut(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
                event.preventDefault();
                if (loading || loadError) return;
                const categoryId = categories.some(category => category.id === activeFilter) ? activeFilter : null;
                void createNoteAndFocusTitle(categoryId);
            }
        }

        window.addEventListener('keydown', handleKeyboardShortcut);
        return () => window.removeEventListener('keydown', handleKeyboardShortcut);
    }, [activeFilter, categories, createNoteAndFocusTitle, loadError, loading]);

    function handleCreateNote() {
        const categoryId = categories.some(category => category.id === activeFilter) ? activeFilter : null;
        void createNoteAndFocusTitle(categoryId);
    }

    function toggleNoteSelection(noteId: string) {
        selectionAnchorIdRef.current = noteId;
        setSelectedNoteIds(current => current.includes(noteId)
            ? current.filter(id => id !== noteId)
            : [...current, noteId]);
    }

    function handlePlainNoteSelection(noteId: string) {
        selectionAnchorIdRef.current = noteId;
        selectNote(noteId);
    }

    function handleSelectionGesture(noteId: string, shiftKey: boolean, additive: boolean) {
        const visibleIds = visibleNotes.map(note => note.id);
        const anchorId = selectionAnchorIdRef.current ?? selectedNoteId;
        const anchorIndex = anchorId ? visibleIds.indexOf(anchorId) : -1;
        const noteIndex = visibleIds.indexOf(noteId);
        setSelectionMode(true);
        setSelectedNoteIds(current => {
            if (shiftKey && anchorIndex >= 0 && noteIndex >= 0) {
                const start = Math.min(anchorIndex, noteIndex);
                const end = Math.max(anchorIndex, noteIndex);
                const range = visibleIds.slice(start, end + 1);
                return [...new Set([...current, ...range])];
            }
            if (additive) {
                return current.includes(noteId)
                    ? current.filter(id => id !== noteId)
                    : [...current, noteId];
            }
            return [noteId];
        });
        if (!shiftKey) selectionAnchorIdRef.current = noteId;
    }

    function selectAllVisibleNotes() {
        const visibleIds = visibleNotes.map(note => note.id);
        setSelectedNoteIds(current => {
            const currentSet = new Set(current);
            const allSelected = visibleIds.every(noteId => currentSet.has(noteId));
            if (allSelected) return current.filter(noteId => !visibleIds.includes(noteId));
            return [...new Set([...current, ...visibleIds])];
        });
    }

    function clearNoteSelection() {
        setSelectedNoteIds([]);
        setSelectionMode(false);
        selectionAnchorIdRef.current = null;
    }

    function handleNotesListClickAway() {
        if (selectionMode && !noteDeleteTarget && !bulkDeleteDialogOpen && !categoryDialogOpen && !categoryToDelete) {
            clearNoteSelection();
        }
    }

    function handleFilterChange(filter: NotesFilter) {
        const categoryId = filter === 'uncategorized'
            ? null
            : categories.some(category => category.id === filter)
                ? filter
                : undefined;

        if (selectionMode && selectedNoteIds.length > 0 && categoryId !== undefined && !bulkActionLoading) {
            setActiveFilter(filter);
            void handleBulkUpdate({ categoryId });
            return;
        }

        setActiveFilter(filter);
    }

    async function handleBulkUpdate(updates: { pinned?: boolean; categoryId?: string | null }) {
        if (!selectedNoteIds.length || bulkActionLoading) return;
        setBulkActionLoading(true);
        const succeeded = await updateNotes(selectedNoteIds, updates);
        setBulkActionLoading(false);
        if (succeeded) clearNoteSelection();
    }

    async function handleBulkDelete() {
        if (!selectedNoteIds.length || bulkActionLoading) return;
        setBulkActionLoading(true);
        const succeeded = await deleteNotes(selectedNoteIds);
        setBulkActionLoading(false);
        setBulkDeleteDialogOpen(false);
        if (succeeded) clearNoteSelection();
    }

    function requestNoteDelete(
        note: Note | null = selectedNote,
        anchorEl: HTMLElement | null = null,
        anchorPosition: NoteDeleteAnchorPosition | null = null,
    ) {
        if (!note) return;
        if (selectedNoteIds.length > 1 && selectedNoteIds.includes(note.id)) {
            setBulkDeleteDialogOpen(true);
        } else {
            setNoteDeleteAnchorEl(anchorEl);
            setNoteDeleteAnchorPosition(anchorPosition ?? (anchorEl ? null : {
                top: window.innerHeight / 2,
                left: window.innerWidth / 2,
            }));
            setNoteDeleteTarget(note);
        }
    }

    function closeNoteDeleteConfirmation() {
        setNoteDeleteTarget(null);
        setNoteDeleteAnchorEl(null);
        setNoteDeleteAnchorPosition(null);
    }

    function requestKeyboardNoteDelete() {
        if (selectedNoteIds.length > 1) {
            setBulkDeleteDialogOpen(true);
            return;
        }

        const selectedKeyboardNote = selectedNoteIds.length === 1
            ? notes.find(note => note.id === selectedNoteIds[0]) ?? null
            : selectedNote;
        requestNoteDelete(selectedKeyboardNote);
    }

    function handleNoteContextMenu(note: Note, event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        event.stopPropagation();
        setSelectedNoteIds([note.id]);
        setSelectionMode(false);
        selectionAnchorIdRef.current = note.id;
        selectNote(note.id);
        setNoteCategoryMenu(null);
        setNoteContextMenu({ note, top: event.clientY + 2, left: event.clientX + 2 });
    }

    function closeNoteContextMenu() {
        setNoteContextMenu(null);
    }

    function handleNoteCategoryMenuOpen() {
        if (!noteContextMenu) return;
        setNoteCategoryMenu(noteContextMenu);
        closeNoteContextMenu();
    }

    function handleNoteCategoryChange(categoryId: string | null) {
        if (!noteCategoryMenu) return;
        const { note } = noteCategoryMenu;
        setNoteCategoryMenu(null);
        updateNote(note.id, { categoryId });
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
                        onFilterChange={handleFilterChange}
                        onAddCategory={() => {
                            setEditingCategory(null);
                            setCategoryDialogOpen(true);
                        }}
                        onCreateNote={category => {
                            setActiveFilter(category.id);
                            void createNoteAndFocusTitle(category.id);
                        }}
                        onEditCategory={category => {
                            setEditingCategory(category);
                            setCategoryDialogOpen(true);
                        }}
                        onDeleteCategory={(category, anchorPosition) => {
                            setCategoryToDelete(category);
                            setCategoryDeleteAnchorPosition(anchorPosition ?? null);
                        }}
                    />}
                    {!focusMode && <ClickAwayListener onClickAway={handleNotesListClickAway}>
                        <Box sx={{ display: 'contents' }}>
                            <NotesList
                                key="notes-list"
                                notes={visibleNotes}
                                categories={categories}
                                selectedNoteId={selectedNoteId}
                                searchQuery={searchQuery}
                                sort={sort}
                                onSearchChange={setSearchQuery}
                                onSortChange={setSort}
                                onSelectNote={handlePlainNoteSelection}
                                onSelectionGesture={handleSelectionGesture}
                                selectedNoteIds={selectedNoteIds}
                                selectionMode={selectionMode}
                                bulkActionLoading={bulkActionLoading}
                                onToggleSelectionMode={() => setSelectionMode(true)}
                                onToggleNoteSelection={toggleNoteSelection}
                                onSelectAllVisible={selectAllVisibleNotes}
                                onClearSelection={clearNoteSelection}
                                onRequestBulkDelete={() => setBulkDeleteDialogOpen(true)}
                                onNoteContextMenu={handleNoteContextMenu}
                            />
                        </Box>
                    </ClickAwayListener>}
                    {selectedNote ? (
                        <NoteEditor
                            key={selectedNote.id}
                            note={selectedNote}
                            categories={categories}
                            saveState={saveState}
                            onUpdate={updates => updateNote(selectedNote.id, updates)}
                            onDraftUpdate={updates => updateNoteDraft(selectedNote.id, updates)}
                            onDelete={anchorEl => requestNoteDelete(selectedNote, anchorEl)}
                            onRetrySave={retryFailedSaves}
                            focusMode={focusMode}
                            onToggleFocusMode={() => setFocusMode(current => !current)}
                            focusTitle={noteIdToFocus === selectedNote.id}
                            onTitleFocusHandled={clearNoteTitleFocus}
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

            <Menu
                open={Boolean(noteContextMenu)}
                onClose={closeNoteContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={noteContextMenu
                    ? { top: noteContextMenu.top, left: noteContextMenu.left }
                    : undefined}
                MenuListProps={{ dense: true }}
                slotProps={{ paper: { sx: { minWidth: 190, borderRadius: 2.5 } } }}
            >
                {noteContextMenu && (
                    <>
                        <MenuItem onClick={() => {
                            const { note } = noteContextMenu;
                            closeNoteContextMenu();
                            updateNote(note.id, { pinned: !note.pinned });
                        }}>
                            <ListItemIcon>
                                {noteContextMenu.note.pinned
                                    ? <PushPinRoundedIcon fontSize="small" />
                                    : <PushPinOutlinedIcon fontSize="small" />}
                            </ListItemIcon>
                            <ListItemText>{noteContextMenu.note.pinned ? 'Unpin note' : 'Pin note'}</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={handleNoteCategoryMenuOpen}>
                            <ListItemIcon><FolderOutlinedIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Change category</ListItemText>
                            <ChevronRightRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </MenuItem>
                        <Divider />
                        <MenuItem
                            onClick={() => {
                                const { note } = noteContextMenu;
                                const anchorPosition = { top: noteContextMenu.top, left: noteContextMenu.left };
                                closeNoteContextMenu();
                                requestNoteDelete(note, null, anchorPosition);
                            }}
                            sx={{ color: 'error.main' }}
                        >
                            <ListItemIcon sx={{ color: 'inherit' }}>
                                <DeleteOutlineRoundedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Delete note</ListItemText>
                        </MenuItem>
                    </>
                )}
            </Menu>

            <Menu
                open={Boolean(noteCategoryMenu)}
                onClose={() => setNoteCategoryMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={noteCategoryMenu
                    ? { top: noteCategoryMenu.top, left: noteCategoryMenu.left }
                    : undefined}
                MenuListProps={{ dense: true }}
                slotProps={{ paper: { sx: { minWidth: 190, borderRadius: 2.5 } } }}
            >
                {noteCategoryMenu && (
                    <>
                        <MenuItem
                            selected={noteCategoryMenu.note.categoryId === null}
                            onClick={() => handleNoteCategoryChange(null)}
                        >
                            <ListItemIcon><FolderOutlinedIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Uncategorized</ListItemText>
                        </MenuItem>
                        {categories.map(category => (
                            <MenuItem
                                key={category.id}
                                selected={noteCategoryMenu.note.categoryId === category.id}
                                onClick={() => handleNoteCategoryChange(category.id)}
                            >
                                <ListItemIcon>
                                    <Box sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: category.color }} />
                                </ListItemIcon>
                                <ListItemText>{category.name}</ListItemText>
                            </MenuItem>
                        ))}
                    </>
                )}
            </Menu>

            <CategoryDialog
                open={categoryDialogOpen}
                category={editingCategory}
                onClose={() => setCategoryDialogOpen(false)}
                onSave={handleCategorySave}
            />

            <Popover
                open={noteDeleteTarget !== null}
                anchorEl={noteDeleteAnchorEl}
                anchorReference={noteDeleteAnchorPosition ? 'anchorPosition' : 'anchorEl'}
                anchorPosition={noteDeleteAnchorPosition ?? undefined}
                onClose={closeNoteDeleteConfirmation}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 1.5,
                            width: 270,
                            maxWidth: 'calc(100vw - 32px)',
                            borderRadius: 2.5,
                        },
                    },
                }}
            >
                {noteDeleteTarget && (
                    <Box>
                        <Typography variant="body2" sx={{ mb: 1.25 }}>
                            Delete “{noteDeleteTarget.title.trim() || 'Untitled'}”?
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                            This cannot be undone.
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Button size="small" onClick={closeNoteDeleteConfirmation}>Cancel</Button>
                            <Button
                                size="small"
                                color="error"
                                variant="contained"
                                onClick={() => {
                                    const target = noteDeleteTarget;
                                    closeNoteDeleteConfirmation();
                                    void deleteNote(target.id);
                                }}
                            >
                                Delete
                            </Button>
                        </Box>
                    </Box>
                )}
            </Popover>

            <CompactPopover
                open={bulkDeleteDialogOpen}
                onClose={() => setBulkDeleteDialogOpen(false)}
                compactConfirmation
            >
                <DialogTitle>Delete {selectedNoteIds.length} notes?</DialogTitle>
                <DialogContent>
                    <DialogContentText>This cannot be undone.</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkDeleteDialogOpen(false)} disabled={bulkActionLoading}>Cancel</Button>
                    <Button color="error" onClick={() => void handleBulkDelete()} disabled={bulkActionLoading}>
                        Delete notes
                    </Button>
                </DialogActions>
            </CompactPopover>

            <CompactPopover
                open={Boolean(categoryToDelete)}
                onClose={() => setCategoryToDelete(null)}
                anchorPosition={categoryDeleteAnchorPosition ?? undefined}
                maxWidth="xs"
                compactConfirmation
            >
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
            </CompactPopover>

            <Snackbar open={Boolean(operationError)} autoHideDuration={5000} onClose={clearOperationError}>
                <Alert severity="error" onClose={clearOperationError} variant="filled">
                    {operationError}
                </Alert>
            </Snackbar>
        </PageWrapper>
    );
}

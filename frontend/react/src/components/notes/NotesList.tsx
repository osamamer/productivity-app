import { memo } from 'react';
import { Box, Checkbox, Chip, IconButton, InputAdornment, MenuItem, Select, TextField, Tooltip, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import { formatDistanceToNow } from 'date-fns';
import { Note, NoteCategory, NoteSort } from '../../types/Note.ts';

interface NotesListProps {
    notes: Note[];
    categories: NoteCategory[];
    selectedNoteId: string | null;
    searchQuery: string;
    sort: NoteSort;
    onSearchChange: (query: string) => void;
    onSortChange: (sort: NoteSort) => void;
    onSelectNote: (noteId: string) => void;
    onSelectionGesture: (noteId: string, shiftKey: boolean, additive: boolean) => void;
    selectedNoteIds: string[];
    selectionMode: boolean;
    bulkActionLoading: boolean;
    onToggleSelectionMode: () => void;
    onToggleNoteSelection: (noteId: string) => void;
    onSelectAllVisible: () => void;
    onClearSelection: () => void;
    onRequestBulkDelete: () => void;
}

function notePreview(content: string) {
    const container = document.createElement('div');
    container.innerHTML = content;
    return container.textContent?.replace(/\s+/g, ' ').trim() || 'No content yet';
}

export const NotesList = memo(function NotesList({
    notes,
    categories,
    selectedNoteId,
    searchQuery,
    sort,
    onSearchChange,
    onSortChange,
    onSelectNote,
    onSelectionGesture,
    selectedNoteIds,
    selectionMode,
    bulkActionLoading,
    onToggleSelectionMode,
    onToggleNoteSelection,
    onSelectAllVisible,
    onClearSelection,
    onRequestBulkDelete,
}: NotesListProps) {
    const categoriesById = new Map(categories.map(category => [category.id, category]));
    const selectedIds = new Set(selectedNoteIds);
    const allVisibleSelected = notes.length > 0 && notes.every(note => selectedIds.has(note.id));

    return (
        <Box
            component="section"
            aria-label="Notes list"
            sx={{
                width: { xs: '100%', md: 310, xl: 340 },
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRight: { md: theme => `1px solid ${theme.palette.divider}` },
                minHeight: { xs: 280, md: 0 },
                maxHeight: { xs: 380, md: 'none' },
            }}
        >
            <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                {selectionMode ? (
                    <>
                        <Checkbox
                            size="small"
                            checked={allVisibleSelected}
                            indeterminate={selectedNoteIds.length > 0 && !allVisibleSelected}
                            onChange={onSelectAllVisible}
                            inputProps={{ 'aria-label': allVisibleSelected ? 'Clear visible note selection' : 'Select all visible notes' }}
                        />
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: 650 }}>
                            {selectedNoteIds.length} selected
                        </Typography>
                        <Tooltip title="Delete selected notes">
                            <IconButton
                                size="small"
                                color="error"
                                disabled={bulkActionLoading || selectedNoteIds.length === 0}
                                onClick={onRequestBulkDelete}
                                aria-label="Delete selected notes"
                            >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Close selection">
                            <IconButton size="small" onClick={onClearSelection} aria-label="Close note selection">
                                <CloseRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </>
                ) : (
                    <Tooltip title="Select notes">
                        <IconButton size="small" onClick={onToggleSelectionMode} aria-label="Select notes">
                            <CheckBoxOutlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                {!selectionMode && <TextField
                        value={searchQuery}
                        autoComplete="off"
                        onChange={event => onSearchChange(event.target.value)}
                        placeholder="Search notes"
                        size="small"
                        fullWidth
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon sx={{ fontSize: 18 }} />
                                    </InputAdornment>
                                ),
                            },
                        }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                    />}
                <Select
                    value={sort}
                    onChange={event => onSortChange(event.target.value as NoteSort)}
                    size="small"
                    aria-label="Sort notes"
                    sx={{ minWidth: 92, borderRadius: 2.5, fontSize: '0.82rem' }}
                >
                    <MenuItem value="updated">Updated</MenuItem>
                    <MenuItem value="created">Created</MenuItem>
                    <MenuItem value="title">Title</MenuItem>
                </Select>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 1.5 }}>
                {notes.length === 0 && (
                    <Box sx={{ px: 2, py: 7, textAlign: 'center', color: 'text.disabled' }}>
                        <NotesRoundedIcon sx={{ fontSize: 32, mb: 1 }} />
                        <Typography variant="body2">No notes found</Typography>
                        <Typography variant="caption">Try another filter or create a note.</Typography>
                    </Box>
                )}

                {notes.map(note => {
                    const category = note.categoryId ? categoriesById.get(note.categoryId) : undefined;
                    const selected = note.id === selectedNoteId || selectedIds.has(note.id);
                    return (
                        <Box
                            key={note.id}
                            role="button"
                            tabIndex={0}
                            onMouseDown={event => {
                                if (event.target === event.currentTarget && (event.shiftKey || event.ctrlKey || event.metaKey || selectionMode)) {
                                    event.preventDefault();
                                } else if (event.shiftKey || event.ctrlKey || event.metaKey) {
                                    event.preventDefault();
                                }
                            }}
                            onClick={event => {
                                const additive = event.ctrlKey || event.metaKey;
                                if (event.shiftKey || additive) {
                                    event.preventDefault();
                                    onSelectionGesture(note.id, event.shiftKey, additive);
                                } else if (selectionMode) {
                                    onToggleNoteSelection(note.id);
                                } else {
                                    onSelectNote(note.id);
                                }
                            }}
                            onKeyDown={event => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                event.preventDefault();
                                if (selectionMode) onToggleNoteSelection(note.id);
                                else onSelectNote(note.id);
                            }}
                            sx={{
                                width: '100%',
                                display: 'block',
                                textAlign: 'left',
                                border: 0,
                                borderRadius: 2.5,
                                p: 1.5,
                                mb: 0.5,
                                color: 'text.primary',
                                backgroundColor: selected ? 'action.selected' : 'transparent',
                                cursor: 'pointer',
                                userSelect: 'none',
                                '&:hover': { backgroundColor: 'action.hover' },
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                                {selectionMode && <Checkbox
                                    size="small"
                                    checked={selectedIds.has(note.id)}
                                    onClick={event => event.stopPropagation()}
                                    onChange={() => onToggleNoteSelection(note.id)}
                                    inputProps={{ 'aria-label': `${selectedIds.has(note.id) ? 'Deselect' : 'Select'} ${note.title.trim() || 'Untitled'}` }}
                                    sx={{ p: 0, mr: 0.25 }}
                                />}
                                <Typography variant="subtitle2" noWrap sx={{ flex: 1, fontWeight: 700 }}>
                                    {note.title.trim() || 'Untitled'}
                                </Typography>
                                {note.pinned && <PushPinRoundedIcon color="primary" sx={{ fontSize: 14, transform: 'rotate(24deg)' }} />}
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                minHeight: '2.5em',
                                lineHeight: 1.25,
                            }}>
                                {notePreview(note.content)}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
                                {category && (
                                    <Chip
                                        size="small"
                                        label={category.name}
                                        sx={{
                                            height: 20,
                                            fontSize: '0.67rem',
                                            backgroundColor: `${category.color}1f`,
                                            color: category.color,
                                            '& .MuiChip-label': { px: 0.75 },
                                        }}
                                    />
                                )}
                                <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
                                    {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
});

import { memo } from 'react';
import { Box, Chip, InputAdornment, MenuItem, Select, TextField, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
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
}: NotesListProps) {
    const categoriesById = new Map(categories.map(category => [category.id, category]));

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
            <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
                <TextField
                    value={searchQuery}
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
                />
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
                    const selected = note.id === selectedNoteId;
                    return (
                        <Box
                            component="button"
                            key={note.id}
                            type="button"
                            onClick={() => onSelectNote(note.id)}
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
                                '&:hover': { backgroundColor: 'action.hover' },
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
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

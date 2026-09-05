import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Box, Chip, IconButton, MenuItem, Select, Tooltip, Typography } from '@mui/material';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { format } from 'date-fns';
import { alpha } from '@mui/material/styles';
import { Note, NoteCategory } from '../../types/Note.ts';
import './notesEditor.css';

const editorModules = {
    toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link'],
        ['clean'],
    ],
};

const editorFormats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'blockquote',
    'code-block',
    'link',
];

interface NoteEditorProps {
    note: Note;
    categories: NoteCategory[];
    saveState: 'saved' | 'saving' | 'error';
    onUpdate: (updates: Partial<Pick<Note, 'categoryId' | 'pinned'>>) => void;
    onDraftUpdate: (updates: NoteDraftPatch) => void;
    onDelete: () => void;
    onRetrySave: () => void;
    focusMode: boolean;
    onToggleFocusMode: () => void;
    focusTitle: boolean;
    onTitleFocusHandled: () => void;
}

type NoteDraftPatch = Partial<Pick<Note, 'title' | 'content'>>;

const WORD_COUNT_UPDATE_DELAY_MS = 600;

function countWords(content: string) {
    const container = document.createElement('div');
    container.innerHTML = content;
    const plainText = container.textContent?.trim() ?? '';
    return plainText ? plainText.split(/\s+/).length : 0;
}

interface NoteDraftEditorProps {
    noteId: string;
    title: string;
    content: string;
    createdAt: string;
    onDraftUpdate: (updates: NoteDraftPatch) => void;
    focusTitle: boolean;
    onTitleFocusHandled: () => void;
}

function NoteDraftEditorView({
    noteId,
    title,
    content,
    createdAt,
    onDraftUpdate,
    focusTitle,
    onTitleFocusHandled,
}: NoteDraftEditorProps) {
    const [draftTitle, setDraftTitle] = useState(title);
    const [wordCount, setWordCount] = useState(() => countWords(content));
    const titleRef = useRef<HTMLInputElement | null>(null);
    const quillRef = useRef<ReactQuill | null>(null);
    const wordCountTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!focusTitle) return;
        titleRef.current?.focus();
        onTitleFocusHandled();
    }, [focusTitle, onTitleFocusHandled]);

    useEffect(() => () => {
        if (wordCountTimerRef.current !== null) window.clearTimeout(wordCountTimerRef.current);
    }, []);

    function queueDraftUpdate(updates: NoteDraftPatch) {
        onDraftUpdate(updates);

        const content = updates.content;
        if (content !== undefined) {
            if (wordCountTimerRef.current !== null) window.clearTimeout(wordCountTimerRef.current);
            wordCountTimerRef.current = window.setTimeout(() => {
                wordCountTimerRef.current = null;
                setWordCount(countWords(content));
            }, WORD_COUNT_UPDATE_DELAY_MS);
        }
    }

    return (
        <Box className="notes-editor-scroll" sx={{ flex: 1, overflowY: 'auto' }}>
            <Box sx={{ maxWidth: 880, width: '100%', minHeight: '100%', mx: 'auto', px: { xs: 2.5, md: 5, xl: 7 }, pt: { xs: 3, md: 5 }, pb: 5 }}>
                <Box
                    component="input"
                    ref={titleRef}
                    value={draftTitle}
                    onChange={event => {
                        const nextTitle = event.target.value;
                        setDraftTitle(nextTitle);
                        queueDraftUpdate({ title: nextTitle });
                    }}
                    onKeyDown={event => {
                        if (event.key === 'Tab' && !event.shiftKey) {
                            event.preventDefault();
                            quillRef.current?.focus();
                        }
                    }}
                    placeholder="Untitled"
                    aria-label="Note title"
                    sx={{
                        width: '100%',
                        p: 0,
                        mb: 1,
                        border: 0,
                        outline: 0,
                        background: 'transparent',
                        color: 'text.primary',
                        fontSize: { xs: '2rem', md: '2.55rem' },
                        fontWeight: 700,
                        lineHeight: 1.15,
                        letterSpacing: '-0.035em',
                        '&::placeholder': { color: 'text.disabled', opacity: 1 },
                    }}
                />
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 3, textAlign: 'left' }}>
                    Created {format(new Date(createdAt), 'MMM d, yyyy')} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </Typography>
                <Box
                    className="notes-rich-editor"
                    sx={theme => ({
                        '--notes-toolbar-foreground': theme.palette.text.secondary,
                        '--notes-toolbar-foreground-strong': theme.palette.text.primary,
                        '--notes-toolbar-surface': theme.palette.background.paper,
                        '--notes-toolbar-border': theme.palette.divider,
                        '--notes-toolbar-hover': alpha(theme.palette.text.primary, 0.08),
                        '--notes-toolbar-active': alpha(theme.palette.text.primary, 0.14),
                        color: 'text.primary',
                        '& .ql-toolbar.ql-snow': {
                            backgroundColor: 'background.paper',
                        },
                    })}
                >
                    <ReactQuill
                        key={noteId}
                        ref={quillRef}
                        theme="snow"
                        scrollingContainer=".notes-editor-scroll"
                        defaultValue={content}
                        onChange={(nextContent, _delta, source) => {
                            if (source !== 'user') return;
                            queueDraftUpdate({ content: nextContent });
                        }}
                        modules={editorModules}
                        formats={editorFormats}
                        placeholder="Start writing. Capture an idea, make a list, or think out loud…"
                    />
                </Box>
            </Box>
        </Box>
    );
}

const NoteDraftEditor = memo(NoteDraftEditorView, (previous, next) => (
    previous.noteId === next.noteId
    && previous.focusTitle === next.focusTitle
    && previous.onDraftUpdate === next.onDraftUpdate
    && previous.onTitleFocusHandled === next.onTitleFocusHandled
));

export function NoteEditor({
    note,
    categories,
    saveState,
    onUpdate,
    onDraftUpdate,
    onDelete,
    onRetrySave,
    focusMode,
    onToggleFocusMode,
    focusTitle,
    onTitleFocusHandled,
}: NoteEditorProps) {
    const onDraftUpdateRef = useRef(onDraftUpdate);

    useEffect(() => {
        onDraftUpdateRef.current = onDraftUpdate;
    }, [onDraftUpdate]);

    const handleDraftUpdate = useCallback((updates: NoteDraftPatch) => {
        onDraftUpdateRef.current(updates);
    }, []);

    // Keeping Quill uncontrolled avoids replacing its whole document when save-state updates rerender this page.
    return (
        <Box component="article" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{
                minHeight: 58,
                px: { xs: 2, lg: 3 },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderBottom: theme => `1px solid ${theme.palette.divider}`,
            }}>
                {!focusMode && <Select
                    value={note.categoryId ?? ''}
                    onChange={event => onUpdate({ categoryId: event.target.value || null })}
                    size="small"
                    displayEmpty
                    aria-label="Note category"
                    sx={{ minWidth: 145, borderRadius: 2, fontSize: '0.82rem' }}
                >
                    <MenuItem value="">Uncategorized</MenuItem>
                    {categories.map(category => (
                        <MenuItem key={category.id} value={category.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: category.color }} />
                                {category.name}
                            </Box>
                        </MenuItem>
                    ))}
                </Select>}
                <Chip
                    variant="outlined"
                    size="small"
                    icon={saveState === 'error' ? <ErrorOutlineRoundedIcon /> : <AutoAwesomeOutlinedIcon />}
                    label={saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Retry save' : 'Saved'}
                    color={saveState === 'error' ? 'error' : 'default'}
                    clickable={saveState === 'error'}
                    onClick={saveState === 'error' ? onRetrySave : undefined}
                    sx={{ ml: 'auto', color: saveState === 'error' ? undefined : 'text.secondary', borderColor: 'divider', '& .MuiChip-icon': { fontSize: 15 } }}
                />
                <Tooltip title={focusMode ? 'Exit focus mode' : 'Focus on this note'}>
                    <IconButton
                        onClick={onToggleFocusMode}
                        aria-label={focusMode ? 'Exit focus mode' : 'Focus on this note'}
                        aria-pressed={focusMode}
                    >
                        {focusMode ? <CloseFullscreenRoundedIcon /> : <FullscreenRoundedIcon />}
                    </IconButton>
                </Tooltip>
                <Tooltip title={note.pinned ? 'Unpin note' : 'Pin note'}>
                    <IconButton onClick={() => onUpdate({ pinned: !note.pinned })} aria-label={note.pinned ? 'Unpin note' : 'Pin note'}>
                        {note.pinned
                            ? <PushPinRoundedIcon color="primary" sx={{ transform: 'rotate(24deg)' }} />
                            : <PushPinOutlinedIcon />}
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete note">
                    <IconButton onClick={onDelete} aria-label="Delete note">
                        <DeleteOutlineRoundedIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            <NoteDraftEditor
                key={note.id}
                noteId={note.id}
                title={note.title}
                content={note.content}
                createdAt={note.createdAt}
                onDraftUpdate={handleDraftUpdate}
                focusTitle={focusTitle}
                onTitleFocusHandled={onTitleFocusHandled}
            />
        </Box>
    );
}

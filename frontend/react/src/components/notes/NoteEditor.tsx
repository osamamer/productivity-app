import { useEffect, useRef, useState } from 'react';
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
    onCommitDraft: (updates: NoteDraftPatch) => void;
    onDelete: () => void;
    onRetrySave: () => void;
    focusMode: boolean;
    onToggleFocusMode: () => void;
}

type NoteDraftPatch = Partial<Pick<Note, 'title' | 'content'>>;

const DRAFT_COMMIT_DELAY_MS = 600;

function countWords(content: string) {
    const container = document.createElement('div');
    container.innerHTML = content;
    const plainText = container.textContent?.trim() ?? '';
    return plainText ? plainText.split(/\s+/).length : 0;
}

export function NoteEditor({
    note,
    categories,
    saveState,
    onUpdate,
    onDraftUpdate,
    onCommitDraft,
    onDelete,
    onRetrySave,
    focusMode,
    onToggleFocusMode,
}: NoteEditorProps) {
    const [draftTitle, setDraftTitle] = useState(note.title);
    const [draftContent, setDraftContent] = useState(note.content);
    const [wordCount, setWordCount] = useState(() => countWords(note.content));
    const quillRef = useRef<ReactQuill | null>(null);
    const pendingDraftRef = useRef<NoteDraftPatch>({});
    const commitTimerRef = useRef<number | null>(null);
    const onCommitDraftRef = useRef(onCommitDraft);

    useEffect(() => {
        onCommitDraftRef.current = onCommitDraft;
    }, [onCommitDraft]);

    useEffect(() => () => {
        if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
        if (Object.keys(pendingDraftRef.current).length > 0) {
            onCommitDraftRef.current(pendingDraftRef.current);
        }
    }, []);

    function queueDraftUpdate(updates: NoteDraftPatch) {
        pendingDraftRef.current = { ...pendingDraftRef.current, ...updates };
        onDraftUpdate(updates);

        if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = window.setTimeout(() => {
            const pendingDraft = pendingDraftRef.current;
            pendingDraftRef.current = {};
            commitTimerRef.current = null;
            if (pendingDraft.content !== undefined) {
                setWordCount(countWords(pendingDraft.content));
            }
            onCommitDraftRef.current(pendingDraft);
        }, DRAFT_COMMIT_DELAY_MS);
    }

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

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                <Box sx={{ maxWidth: 880, width: '100%', minHeight: '100%', mx: 'auto', px: { xs: 2.5, md: 5, xl: 7 }, pt: { xs: 3, md: 5 }, pb: 5 }}>
                    <Box
                        component="input"
                        value={draftTitle}
                        onChange={event => {
                            const title = event.target.value;
                            setDraftTitle(title);
                            queueDraftUpdate({ title });
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
                        Created {format(new Date(note.createdAt), 'MMM d, yyyy')} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
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
                            key={note.id}
                            ref={quillRef}
                            theme="snow"
                            value={draftContent}
                            onChange={(content, _delta, source) => {
                                if (source !== 'user') return;
                                setDraftContent(content);
                                queueDraftUpdate({ content });
                            }}
                            modules={editorModules}
                            formats={editorFormats}
                            placeholder="Start writing. Capture an idea, make a list, or think out loud…"
                        />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

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
import type { DeltaStatic } from 'quill';
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
    keyboard: {
        bindings: {
            // Quill's default binding only indents when the cursor is at the start of a list item.
            // Keep Tab useful for nested lists even after the item already contains text.
            'notes indent list': {
                key: 'Tab',
                format: ['list'],
                handler: function (this: { quill: { format: (name: string, value: string, source: string) => void } }, _range: unknown, context: { collapsed: boolean; offset: number }) {
                    if (context.collapsed && context.offset === 0) return true;
                    this.quill.format('indent', '+1', 'user');
                },
            },
            'notes outdent list': {
                key: 'Tab',
                shiftKey: true,
                format: ['list'],
                handler: function (this: { quill: { format: (name: string, value: string, source: string) => void } }, _range: unknown, context: { collapsed: boolean; offset: number }) {
                    if (context.collapsed && context.offset === 0) return true;
                    this.quill.format('indent', '-1', 'user');
                },
            },
        },
    },
};

const editorFormats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'indent',
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
    onDelete: (anchorEl: HTMLElement) => void;
    onRetrySave: () => void;
    focusMode: boolean;
    onToggleFocusMode: () => void;
    focusTitle: boolean;
    onTitleFocusHandled: () => void;
}

type NoteDraftPatch = Partial<Pick<Note, 'title' | 'content'>>;

type ListFormat = 'ordered' | 'bullet' | 'checked' | 'unchecked';

const LIST_FORMATS = new Set<ListFormat>(['ordered', 'bullet', 'checked', 'unchecked']);

function getPastedLines(text: string): string[] {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');

    // Clipboard text commonly ends with a newline. It terminates the final
    // source line rather than representing another empty list item.
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();

    // Some rich-text sources export an empty line between each visual line.
    // Empty list items are not useful for this paste interaction.
    return lines.filter(line => line.trim().length > 0);
}

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
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const wordCountTimerRef = useRef<number | null>(null);

    function keepEndCaretInWritingSpace() {
        const quill = quillRef.current?.getEditor();
        const scrollContainer = scrollContainerRef.current;
        const selection = quill?.getSelection();
        if (!quill || !scrollContainer || !selection || selection.length > 0) return;
        if (selection.index < quill.getLength() - 1) return;

        const caretBounds = quill.getBounds(selection.index);
        const editorContainer = quill.root.parentElement;
        if (!caretBounds || !editorContainer) return;

        const viewportBottom = scrollContainer.getBoundingClientRect().bottom;
        const caretBottom = editorContainer.getBoundingClientRect().top + caretBounds.bottom;
        const spaceBelowCaret = Math.min(240, Math.max(120, scrollContainer.clientHeight * 0.2));
        const targetBottom = viewportBottom - spaceBelowCaret;

        if (caretBottom > targetBottom) {
            scrollContainer.scrollTop += caretBottom - targetBottom;
        }
    }

    useEffect(() => {
        if (!focusTitle) return;
        titleRef.current?.focus();
        onTitleFocusHandled();
    }, [focusTitle, onTitleFocusHandled]);

    useEffect(() => {
        if (title.trim() && !draftTitle.trim()) setDraftTitle(title);
    }, [draftTitle, title]);

    useEffect(() => {
        const quill = quillRef.current?.getEditor();
        if (!quill) return;

        const handleListPaste = (event: ClipboardEvent) => {
            if (event.defaultPrevented || !event.clipboardData) return;

            const pastedText = event.clipboardData.getData('text/plain');
            if (!pastedText.includes('\n') && !pastedText.includes('\r')) return;

            const range = quill.getSelection();
            if (!range) return;

            const listFormat = quill.getFormat(range.index).list;
            if (typeof listFormat !== 'string' || !LIST_FORMATS.has(listFormat as ListFormat)) return;

            const lines = getPastedLines(pastedText);
            if (lines.length === 0) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            const Delta = ReactQuill.Quill.import('delta') as new () => DeltaStatic;
            const paste = new Delta();
            if (range.index > 0) paste.retain(range.index);
            if (range.length > 0) paste.delete(range.length);

            const insertedText = lines.join('\n');
            paste.insert(insertedText);

            quill.updateContents(paste, 'user');
            quill.formatLine(range.index, Math.max(insertedText.length, 1), { list: listFormat }, 'user');
            quill.setSelection(range.index + insertedText.length, 0, 'silent');
            quill.focus();
        };

        // Quill's own listener is attached in the bubbling phase. Handling the
        // event here lets us prevent its newline-collapsing conversion first.
        quill.root.addEventListener('paste', handleListPaste, true);
        return () => quill.root.removeEventListener('paste', handleListPaste, true);
    }, [noteId]);

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
        <Box ref={scrollContainerRef} className="notes-editor-scroll" sx={{ flex: 1, overflowY: 'auto' }}>
            <Box sx={{ maxWidth: 880, width: '100%', minHeight: '100%', mx: 'auto', px: { xs: 2.5, md: 5, xl: 7 }, pt: { xs: 3, md: 5 }, pb: 'clamp(180px, 28vh, 320px)' }}>
                <Box
                    component="input"
                    ref={titleRef}
                    value={draftTitle}
                    onChange={event => {
                        const nextTitle = event.target.value;
                        setDraftTitle(nextTitle);
                        queueDraftUpdate({ title: nextTitle });
                    }}
                    onBlur={() => {
                        if (!draftTitle.trim()) queueDraftUpdate({ title: '' });
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
                            window.requestAnimationFrame(keepEndCaretInWritingSpace);
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
    && previous.title === next.title
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
                    <IconButton onClick={event => onDelete(event.currentTarget)} aria-label="Delete note">
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

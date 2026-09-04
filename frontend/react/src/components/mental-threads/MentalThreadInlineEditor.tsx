import { useEffect, useLayoutEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
    Box,
    Slider,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { MentalThread, MentalThreadInput } from '../../types/MentalThread.ts';
import { attentionStateDetails } from './mentalThreadPresentation.ts';

interface MentalThreadInlineEditorProps {
    thread: MentalThread;
    onSave: (input: MentalThreadInput) => Promise<boolean>;
    readOnly?: boolean;
    accentColor?: string;
}

interface InlineTextProps {
    value: string;
    placeholder: string;
    onCommit: (value: string) => void;
    variant?: 'title' | 'body';
    multiline?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
}

interface InlineDateFieldProps {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    disabled?: boolean;
}

function parseDateOnly(value: string): Date | null {
    const [year, month, day] = value.split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) return null;

    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
        ? date
        : null;
}

function formatDateOnly(date: Date | null): string {
    if (!date || Number.isNaN(date.getTime())) return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function inputFromThread(thread: MentalThread): MentalThreadInput {
    return {
        title: thread.title,
        description: thread.description,
        attentionState: thread.attentionState,
        desiredResolution: thread.desiredResolution,
        targetCloseDate: thread.targetCloseDate,
        hardDeadlineDate: thread.hardDeadlineDate,
        nextReviewDate: thread.nextReviewDate,
        currentMentalLoad: thread.currentMentalLoad,
        loadReason: null,
    };
}

function normalizeInput(input: MentalThreadInput): MentalThreadInput {
    return {
        ...input,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        desiredResolution: input.desiredResolution?.trim() || null,
        loadReason: null,
    };
}

function inputsMatch(first: MentalThreadInput, second: MentalThreadInput): boolean {
    return first.title === second.title
        && first.description === second.description
        && first.attentionState === second.attentionState
        && first.desiredResolution === second.desiredResolution
        && first.targetCloseDate === second.targetCloseDate
        && first.hardDeadlineDate === second.hardDeadlineDate
        && first.nextReviewDate === second.nextReviewDate
        && first.currentMentalLoad === second.currentMentalLoad;
}

function InlineText({
    value,
    placeholder,
    onCommit,
    variant = 'body',
    multiline = false,
    disabled = false,
    readOnly = false,
}: InlineTextProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    useEffect(() => {
        if (!editing) setDraft(value);
    }, [editing, value]);

    useLayoutEffect(() => {
        if (!editing || !inputRef.current) return;
        const input = inputRef.current;
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
    }, [editing]);

    const startEditing = () => {
        if (disabled || readOnly) return;
        setDraft(value);
        setEditing(true);
    };

    const cancelEditing = () => {
        setDraft(value);
        setEditing(false);
    };

    const commitEditing = () => {
        setEditing(false);
        onCommit(draft.trim());
    };

    return (
        <Box sx={{ position: 'relative', minHeight: variant === 'title' ? '2.25rem' : '1.5em' }}>
            <Typography
                variant={variant === 'title' ? 'h5' : 'body2'}
                onClick={startEditing}
                sx={{
                    minHeight: variant === 'title' ? '2.25rem' : '1.5em',
                    overflowWrap: 'anywhere',
                    whiteSpace: multiline ? 'pre-wrap' : undefined,
                    color: value ? 'text.primary' : 'text.secondary',
                    cursor: disabled || readOnly ? 'default' : 'text',
                    opacity: disabled && !readOnly ? 0.72 : 1,
                    visibility: editing ? 'hidden' : 'visible',
                }}
            >
                {value || placeholder}
            </Typography>
            {editing && (
                <TextField
                    inputRef={inputRef}
                    autoComplete="off"
                    fullWidth
                    multiline={multiline}
                    minRows={multiline ? 1 : undefined}
                    maxRows={multiline ? 6 : undefined}
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    onBlur={commitEditing}
                    onKeyDown={event => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelEditing();
                        }
                        if (event.key === 'Enter' && !multiline) {
                            event.preventDefault();
                            commitEditing();
                        }
                    }}
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    inputProps={{ maxLength: variant === 'title' ? 160 : 5000 }}
                    sx={theme => ({
                        position: 'absolute',
                        inset: 0,
                        '& .MuiInputBase-root': {
                            p: 0,
                            height: '100%',
                            fontFamily: theme.typography.fontFamily,
                            ...(variant === 'title' ? theme.typography.h5 : theme.typography.body2),
                        },
                        '& .MuiInputBase-input': {
                            font: 'inherit',
                            letterSpacing: 'inherit',
                            p: 0,
                        },
                    })}
            />
            )}
        </Box>
    );
}

function InlineDateField({ value, onChange, ariaLabel, disabled = false }: InlineDateFieldProps) {
    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
                label="Target close"
                value={parseDateOnly(value)}
                onChange={date => onChange(formatDateOnly(date))}
                format="MMM d, yyyy"
                disabled={disabled}
                slotProps={{
                    field: { clearable: true },
                    textField: {
                        size: 'small',
                        fullWidth: true,
                        helperText: 'When you hope it is settled',
                        inputProps: { 'aria-label': ariaLabel },
                    },
                    popper: {
                        sx: theme => ({
                            '& .MuiPaper-root': {
                                borderRadius: 2.5,
                                backgroundImage: 'none',
                                border: `1px solid ${theme.palette.divider}`,
                                boxShadow: theme.shadows[8],
                            },
                            '& .MuiPickersCalendarHeader-root': {
                                px: 1.5,
                                pt: 1,
                            },
                        }),
                    },
                }}
            />
        </LocalizationProvider>
    );
}

export function MentalThreadInlineEditor({
    thread,
    onSave,
    readOnly = false,
    accentColor,
}: MentalThreadInlineEditorProps) {
    const [input, setInput] = useState<MentalThreadInput>(() => inputFromThread(thread));
    const originalInput = inputFromThread(thread);
    const stateDetails = attentionStateDetails[thread.attentionState];
    const displayColor = accentColor ?? stateDetails.color;

    useEffect(() => {
        const nextInput = inputFromThread(thread);
        setInput(current => inputsMatch(current, nextInput) ? current : nextInput);
    }, [thread]);

    const save = (nextInput: MentalThreadInput) => {
        const normalized = normalizeInput(nextInput);
        if (readOnly || !normalized.title || inputsMatch(normalized, originalInput)) return;

        setInput(normalized);
        void onSave(normalized).then(saved => {
            if (!saved) {
                setInput(current => inputsMatch(current, normalized) ? originalInput : current);
            }
        });
    };

    const updateText = (key: 'title' | 'description' | 'desiredResolution', value: string) => {
        void save({ ...input, [key]: value });
    };

    const updateLoad = (_event: Event, value: number | number[]) => {
        const nextLoad = Array.isArray(value) ? value[0] : value;
        setInput(current => ({ ...current, currentMentalLoad: nextLoad }));
    };

    const commitLoad = (_event: Event | SyntheticEvent, value: number | number[]) => {
        const nextLoad = Array.isArray(value) ? value[0] : value;
        if (nextLoad !== thread.currentMentalLoad) {
            void save({ ...input, currentMentalLoad: nextLoad });
        }
    };

    const updateTargetClose = (value: string) => {
        const nextDate = value || null;
        if (nextDate !== input.targetCloseDate) void save({ ...input, targetCloseDate: nextDate });
    };

    return (
        <Stack spacing={1.25}>
            <InlineText
                value={input.title}
                placeholder="What is occupying your mind?"
                variant="title"
                onCommit={value => updateText('title', value)}
                disabled={readOnly}
                readOnly={readOnly}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 1.5, sm: 3 }, alignItems: 'start' }}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="baseline" spacing={0.75}>
                        <Typography variant="overline" color="text.secondary">Mental load</Typography>
                        <Typography variant="body2" fontWeight={750} color={displayColor}>
                            {input.currentMentalLoad}/10
                        </Typography>
                    </Stack>
                    <Slider
                        value={input.currentMentalLoad}
                        onChange={updateLoad}
                        onChangeCommitted={commitLoad}
                        min={1}
                        max={10}
                        step={1}
                        marks
                        valueLabelDisplay="auto"
                        disabled={readOnly}
                        aria-label="Mental load"
                        sx={{ color: displayColor, mt: 0.25, width: { xs: '100%', sm: 'calc(100% - 12px)' } }}
                    />
                </Box>
                <Box sx={{ minWidth: 0, pt: { sm: 2 } }}>
                    <InlineDateField
                        value={input.targetCloseDate ?? ''}
                        onChange={updateTargetClose}
                        ariaLabel="Target close date"
                        disabled={readOnly}
                    />
                </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 1.5, sm: 3 }, alignItems: 'start', mt: { xs: 1, md: 1.25 } }}>
                {(!readOnly || Boolean(input.description)) && (
                    <Box sx={{ minWidth: 0 }}>
                        {Boolean(input.description) && (
                            <Typography variant="overline" color="text.secondary" display="block">Context</Typography>
                        )}
                        <InlineText
                            value={input.description ?? ''}
                            placeholder="Add context…"
                            multiline
                            onCommit={value => updateText('description', value)}
                            disabled={readOnly}
                            readOnly={readOnly}
                        />
                    </Box>
                )}
                {(!readOnly || Boolean(input.desiredResolution)) && (
                    <Box sx={{ minWidth: 0 }}>
                        {Boolean(input.desiredResolution) && (
                            <Typography variant="overline" color="text.secondary" display="block">What closure means</Typography>
                        )}
                        <InlineText
                            value={input.desiredResolution ?? ''}
                            placeholder="What would make this feel complete?"
                            multiline
                            onCommit={value => updateText('desiredResolution', value)}
                            disabled={readOnly}
                            readOnly={readOnly}
                        />
                    </Box>
                )}
            </Box>
        </Stack>
    );
}

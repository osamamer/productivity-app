import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    TextField,
    Popover,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Chip,
    Paper,
    Typography,
    Button,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FlagIcon from '@mui/icons-material/Flag';
import LabelIcon from '@mui/icons-material/Label';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { TaskToCreate } from '../../types/TaskToCreate';

type SmartTaskInputProps = {
    onSubmit: (taskToCreate: TaskToCreate) => void;
    initialDate?: string;
    defaultToToday?: boolean;
    autoFocus?: boolean;
    parentId?: string;
    placeholder?: string;
    submitOnBlur?: boolean;
    onEscape?: () => void;
    disabled?: boolean;
    onBlur?: () => void;
    onImportanceChange?: (importance: number) => void;
    showMetadataChips?: boolean;
    textFieldSx?: SxProps<Theme>;
    multiline?: boolean;
    minRows?: number;
    maxRows?: number;
    inputProps?: Record<string, unknown>;
};

type TaskMetadata = {
    importance: number;
    scheduledDate: string;
    reminderMinutesBefore: number | null;
    reminderDateTime: string | null;
    tag: string;
};

const MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;

const removeCommands = (value: string, commands: RegExp) => value
    .replace(commands, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

function formatLocalDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:00`;
}

function dateAtCurrentTime(date: Date): string {
    const currentTime = new Date();
    const value = new Date(date);
    value.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0);
    return formatLocalDateTime(value);
}

export function SmartTaskInput({
    onSubmit,
    initialDate,
    defaultToToday = false,
    autoFocus,
    parentId,
    placeholder,
    submitOnBlur = false,
    onEscape,
    disabled = false,
    onBlur,
    onImportanceChange,
    showMetadataChips = true,
    textFieldSx,
    multiline,
    minRows,
    maxRows,
    inputProps,
}: SmartTaskInputProps) {
    const [input, setInput] = useState('');
    const [metadata, setMetadata] = useState<TaskMetadata>({
        importance: 0,
        scheduledDate: initialDate || '',
        reminderMinutesBefore: null,
        reminderDateTime: null,
        tag: '',
    });
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [suggestionType, setSuggestionType] = useState<'priority' | 'date' | 'reminder' | 'tag' | null>(null);
    const [showCustomDateTime, setShowCustomDateTime] = useState(false);
    const [showCustomReminder, setShowCustomReminder] = useState(false);
    const [customReminderError, setCustomReminderError] = useState<string | null>(null);
    const [selectedReminderDate, setSelectedReminderDate] = useState<Date>(new Date());
    const [selectedReminderTime, setSelectedReminderTime] = useState<Date | null>(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<Date | null>(new Date());
    const inputRef = useRef<HTMLInputElement>(null);

    const todayDateTime = () => {
        return dateAtCurrentTime(new Date());
    };

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const priorityOptions = [
        { label: 'Low', value: 3, color: '#1976d2' },
        { label: 'Medium', value: 6, color: '#eab308' },
        { label: 'High', value: 9, color: '#ef4444' },
    ];

    const dateOptions = [
        {
            label: 'Today',
            getValue: () => dateAtCurrentTime(new Date()),
        },
        {
            label: 'Tomorrow',
            getValue: () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                return dateAtCurrentTime(tomorrow);
            }
        },
    ];

    const tagOptions = [
        { label: 'Work', color: '#1976d2' },
        { label: 'Personal', color: '#9c27b0' },
        { label: 'Health', color: '#4caf50' },
        { label: 'Shopping', color: '#ff9800' },
        { label: 'Learning', color: '#00bcd4' },
    ];

    useEffect(() => {
        const text = input.toLowerCase();

        if (text.includes('!priority') || text.includes('!p')) {
            setSuggestionType('priority');
            setShowCustomDateTime(false);
            setShowCustomReminder(false);
            setAnchorEl(inputRef.current);
        } else if (text.includes('!date') || text.includes('!d')) {
            setSuggestionType('date');
            setShowCustomDateTime(false);
            setShowCustomReminder(false);
            setAnchorEl(inputRef.current);
        } else if (text.includes('!reminder') || text.includes('!r')) {
            setSuggestionType('reminder');
            setShowCustomDateTime(false);
            setAnchorEl(inputRef.current);
        } else if (text.includes('!tag') || text.includes('!t')) {
            setSuggestionType('tag');
            setShowCustomDateTime(false);
            setShowCustomReminder(false);
            setAnchorEl(inputRef.current);
        } else {
            setAnchorEl(null);
            setSuggestionType(null);
            setShowCustomDateTime(false);
            setShowCustomReminder(false);
        }
    }, [input]);

    const submitCurrentInput = () => {
        const taskName = removeCommands(
            input,
            /!priority\b|!p\b|!l\b|!m\b|!h\b|!date\b|!d\b|!reminder\b|!r\b|!tag\b|!t\b/gi,
        );

        if (taskName === '') return;

        const taskToCreate: TaskToCreate = {
            name: taskName,
            description: '',
            // CRITICAL FIX: Use metadata date OR fall back to initialDate
            scheduledPerformDateTime: metadata.scheduledDate || initialDate || (defaultToToday ? todayDateTime() : ''),
            reminderMinutesBefore: metadata.reminderMinutesBefore,
            tag: metadata.tag,
            importance: metadata.importance,
        };
        if (parentId) taskToCreate.parentId = parentId;

        console.log('Creating task:', taskToCreate);

        onSubmit(taskToCreate);
        setInput('');
        // CRITICAL FIX: When resetting, preserve initialDate
        setMetadata({
            importance: 0,
            scheduledDate: initialDate || '', // Keep the initialDate!
            reminderMinutesBefore: null,
            reminderDateTime: null,
            tag: ''
        });
        onImportanceChange?.(0);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        submitCurrentInput();
    };

    const selectPriority = (value: number) => {
        setMetadata(previous => ({ ...previous, importance: value }));
        onImportanceChange?.(value);
        setInput(removeCommands(input, /!priority\b|!p\b/gi));
        setAnchorEl(null);
    };

    const selectDate = (dateValue: string) => {
        setMetadata(previous => ({ ...previous, scheduledDate: dateValue }));
        setInput(removeCommands(input, /!date\b|!d\b/gi));
        setAnchorEl(null);
        setShowCustomDateTime(false);
    };

    const selectReminder = (minutesBefore: number, reminderDateTime: string | null = null) => {
        setMetadata(previous => ({ ...previous, reminderMinutesBefore: minutesBefore, reminderDateTime }));
        setInput(removeCommands(input, /!reminder\b|!r\b/gi));
        setAnchorEl(null);
        setShowCustomReminder(false);
        setCustomReminderError(null);
    };

    const taskScheduledDateTime = () => metadata.scheduledDate || initialDate || (defaultToToday ? todayDateTime() : '');

    const openCustomReminder = () => {
        const scheduledAt = new Date(taskScheduledDateTime());
        const defaultReminderAt = Number.isNaN(scheduledAt.getTime())
            ? new Date()
            : new Date(scheduledAt.getTime() - 60 * 60 * 1000);
        setSelectedReminderDate(defaultReminderAt);
        setSelectedReminderTime(defaultReminderAt);
        setCustomReminderError(null);
        setShowCustomReminder(true);
    };

    const confirmCustomReminder = () => {
        const scheduledAt = new Date(taskScheduledDateTime());
        if (Number.isNaN(scheduledAt.getTime())) {
            setCustomReminderError('Schedule the task before choosing a custom reminder.');
            return;
        }

        const reminderAt = new Date(selectedReminderDate);
        const timeToUse = selectedReminderTime || new Date();
        reminderAt.setHours(timeToUse.getHours(), timeToUse.getMinutes(), 0, 0);
        const minutesBefore = (scheduledAt.getTime() - reminderAt.getTime()) / (60 * 1000);
        if (!Number.isInteger(minutesBefore) || minutesBefore < 0) {
            setCustomReminderError('The reminder must be at or before the task time.');
            return;
        }
        if (minutesBefore > MAX_REMINDER_MINUTES) {
            setCustomReminderError('The reminder can be at most eight weeks before the task.');
            return;
        }

        selectReminder(minutesBefore, formatLocalDateTime(reminderAt));
    };

    const selectTag = (tagValue: string) => {
        setMetadata(previous => ({ ...previous, tag: tagValue }));
        setInput(removeCommands(input, /!tag\b|!t\b/gi));
        setAnchorEl(null);
    };

    const clearMetadata = (field: keyof TaskMetadata) => {
        if (field === 'importance') {
            setMetadata(previous => ({ ...previous, importance: 0 }));
            onImportanceChange?.(0);
            return;
        }
        if (field === 'reminderMinutesBefore') {
            setMetadata(previous => ({ ...previous, reminderMinutesBefore: null, reminderDateTime: null }));
            return;
        }
        if (field === 'reminderDateTime') {
            setMetadata(previous => ({ ...previous, reminderMinutesBefore: null, reminderDateTime: null }));
            return;
        }
        setMetadata(previous => ({ ...previous, [field]: '' }));
    };

    const handleInputChange = (value: string) => {
        const priorityCommand = value.match(/(?:^|[ \t])!([lmh])(?=$|[ \t])/i);
        if (!priorityCommand) {
            setInput(value);
            return;
        }

        const priority = priorityCommand[1].toLowerCase() === 'l'
            ? 3
            : priorityCommand[1].toLowerCase() === 'm'
                ? 6
                : 9;
        setMetadata(previous => ({ ...previous, importance: priority }));
        onImportanceChange?.(priority);
        setInput(removeCommands(value, /!l\b|!m\b|!h\b/gi));
    };

    const formatReminderLabel = (minutesBefore: number, reminderDateTime: string | null) => {
        if (reminderDateTime) return 'Custom reminder';
        if (minutesBefore === 60) return '1h before';
        if (minutesBefore === 1440) return '1 day before';
        return `${minutesBefore} minutes before`;
    };

    const getPriorityColor = (importance: number) => {
        if (importance > 7) return '#ef4444';
        if (importance > 4) return '#eab308';
        return '#1976d2';
    };

    const getPriorityLabel = (importance: number) => {
        if (importance > 7) return 'High';
        if (importance > 4) return 'Medium';
        return 'Low';
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';

        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const taskDate = new Date(date);
        taskDate.setHours(0, 0, 0, 0);

        if (taskDate.getTime() === today.getTime()) return 'Today';
        if (taskDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const confirmCustomDateTime = () => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');

        const timeToUse = selectedTime || new Date();
        const hour = String(timeToUse.getHours()).padStart(2, '0');
        const minute = String(timeToUse.getMinutes()).padStart(2, '0');

        const dateTimeString = `${year}-${month}-${day}T${hour}:${minute}:00`;

        selectDate(dateTimeString);
    };

    const isSuggestionTarget = (target: EventTarget | null) =>
        target instanceof HTMLElement && Boolean(target.closest('[data-smart-task-suggestions]'));

    const baseTextFieldSx = {
        '& .MuiInput-root': {
            fontSize: '0.95rem',
        },
    };
    const mergedTextFieldSx: SxProps<Theme> = textFieldSx === undefined
        ? baseTextFieldSx
        : Array.isArray(textFieldSx)
            ? [baseTextFieldSx, ...textFieldSx]
            : [baseTextFieldSx, textFieldSx];

    return (
        <Box sx={{ width: '100%' }}>
            <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative' }}>
                <TextField
                    inputRef={inputRef}
                    autoComplete="off"
                    disabled={disabled}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            onEscape?.();
                        } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            submitCurrentInput();
                        }
                    }}
                    onBlur={event => {
                        // The popover may autofocus its first option, which is still part of this input interaction.
                        if (isSuggestionTarget(event.relatedTarget)) return;
                        if (submitOnBlur) submitCurrentInput();
                        onBlur?.();
                    }}
                    placeholder={placeholder ?? (parentId ? "Add subtask..." : "Add a task...")}
                    variant="standard"
                    fullWidth
                    multiline={multiline}
                    minRows={minRows}
                    maxRows={maxRows}
                    inputProps={inputProps}
                    sx={mergedTextFieldSx}
                />

                {/* Metadata chips */}
        {showMetadataChips && (metadata.importance > 0 || metadata.scheduledDate || metadata.reminderMinutesBefore !== null || metadata.reminderDateTime !== null || metadata.tag) && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                        {metadata.importance > 0 && (
                            <Chip
                                icon={<FlagIcon sx={{ fontSize: '0.9rem' }} />}
                                label={getPriorityLabel(metadata.importance)}
                                size="small"
                                onDelete={() => clearMetadata('importance')}
                                sx={{
                                    backgroundColor: getPriorityColor(metadata.importance),
                                    color: '#fff',
                                    '& .MuiChip-deleteIcon': {
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        '&:hover': {
                                            color: '#fff',
                                        },
                                    },
                                }}
                            />
                        )}
                        {metadata.scheduledDate && (
                            <Chip
                                icon={<CalendarTodayIcon sx={{ fontSize: '0.9rem' }} />}
                                label={formatDate(metadata.scheduledDate)}
                                size="small"
                                onDelete={() => clearMetadata('scheduledDate')}
                                color="primary"
                            />
                        )}
                        {metadata.reminderMinutesBefore !== null && (
                            <Chip
                                icon={<NotificationsNoneIcon sx={{ fontSize: '0.9rem' }} />}
                                label={formatReminderLabel(metadata.reminderMinutesBefore, metadata.reminderDateTime)}
                                size="small"
                                onDelete={() => clearMetadata('reminderMinutesBefore')}
                                color="secondary"
                            />
                        )}
                        {metadata.tag && (
                            <Chip
                                icon={<LabelIcon sx={{ fontSize: '0.9rem' }} />}
                                label={metadata.tag}
                                size="small"
                                onDelete={() => clearMetadata('tag')}
                                color="secondary"
                            />
                        )}
                    </Box>
                )}
            </Box>

            {/* Suggestions Popover */}
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => {
                    setAnchorEl(null);
                    setShowCustomDateTime(false);
                    setShowCustomReminder(false);
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <Paper
                    data-smart-task-suggestions
                    sx={{ width: showCustomDateTime || showCustomReminder ? 320 : 200, maxHeight: showCustomDateTime || showCustomReminder ? 450 : 200, overflow: 'auto' }}
                >
                    {suggestionType === 'priority' && (
                        <List
                            dense
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const buttons = document.querySelectorAll('[data-priority-option]');
                                    const currentIndex = Array.from(buttons).findIndex(btn => btn === document.activeElement);
                                    const nextIndex = e.key === 'ArrowDown'
                                        ? Math.min(currentIndex + 1, buttons.length - 1)
                                        : Math.max(currentIndex - 1, 0);
                                    (buttons[nextIndex] as HTMLElement)?.focus();
                                }
                            }}
                        >
                            <ListItem sx={{ py: 0.5, minHeight: 'auto' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    Select Priority
                                </Typography>
                            </ListItem>
                            {priorityOptions.map((option, index) => (
                                <ListItemButton
                                    key={option.value}
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => selectPriority(option.value)}
                                    sx={{ py: 0.5, minHeight: 'auto' }}
                                    autoFocus={index === 0}
                                    data-priority-option
                                >
                                    <FlagIcon sx={{ mr: 1, fontSize: '1rem', color: option.color }} />
                                    <ListItemText
                                        primary={option.label}
                                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    )}

                    {suggestionType === 'date' && !showCustomDateTime && (
                        <List
                            dense
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const buttons = document.querySelectorAll('[data-date-option]');
                                    const currentIndex = Array.from(buttons).findIndex(btn => btn === document.activeElement);
                                    const nextIndex = e.key === 'ArrowDown'
                                        ? Math.min(currentIndex + 1, buttons.length - 1)
                                        : Math.max(currentIndex - 1, 0);
                                    (buttons[nextIndex] as HTMLElement)?.focus();
                                }
                            }}
                        >
                            <ListItem sx={{ py: 0.5, minHeight: 'auto' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    Select Date
                                </Typography>
                            </ListItem>
                            {dateOptions.map((option, index) => (
                                <ListItemButton
                                    key={option.label}
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => selectDate(option.getValue())}
                                    sx={{ py: 0.5, minHeight: 'auto' }}
                                    autoFocus={index === 0}
                                    data-date-option
                                >
                                    <CalendarTodayIcon sx={{ mr: 1, fontSize: '1rem', color: 'primary.main' }} />
                                    <ListItemText
                                        primary={option.label}
                                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                                    />
                                </ListItemButton>
                            ))}
                            <ListItemButton
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => setShowCustomDateTime(true)}
                                sx={{ py: 0.5, minHeight: 'auto' }}
                                data-date-option
                            >
                                <AccessTimeIcon sx={{ mr: 1, fontSize: '1rem', color: 'secondary.main' }} />
                                <ListItemText
                                    primary="Custom Date & Time"
                                    primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                                />
                            </ListItemButton>
                        </List>
                    )}

                    {suggestionType === 'date' && showCustomDateTime && (
                        <Box sx={{ p: 1 }}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                {/* Calendar */}
                                <DateCalendar
                                    value={selectedDate}
                                    onChange={(newValue) => setSelectedDate(newValue || new Date())}
                                    sx={{
                                        width: '100%',
                                        '& .MuiPickersCalendarHeader-root': {
                                            paddingLeft: 1,
                                            paddingRight: 1,
                                        }
                                    }}
                                />

                                {/* Time picker */}
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                        Select Time
                                    </Typography>
                                    <TimePicker
                                        value={selectedTime}
                                        onChange={(newValue) => setSelectedTime(newValue)}
                                        ampm={false}
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                size: 'small',
                                            },
                                        }}
                                    />
                                </Box>

                                {/* Action buttons */}
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                    <Button
                                        size="small"
                                        onClick={() => setShowCustomDateTime(false)}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={confirmCustomDateTime}
                                    >
                                        Confirm
                                    </Button>
                                </Box>
                            </LocalizationProvider>
                        </Box>
                    )}

                    {suggestionType === 'reminder' && !showCustomReminder && (
                        <List
                            dense
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const buttons = document.querySelectorAll('[data-reminder-option]');
                                    const currentIndex = Array.from(buttons).findIndex(btn => btn === document.activeElement);
                                    const nextIndex = e.key === 'ArrowDown'
                                        ? Math.min(currentIndex + 1, buttons.length - 1)
                                        : Math.max(currentIndex - 1, 0);
                                    (buttons[nextIndex] as HTMLElement)?.focus();
                                }
                            }}
                        >
                            <ListItem sx={{ py: 0.5, minHeight: 'auto' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    Select Reminder
                                </Typography>
                            </ListItem>
                            {[
                                { label: '1h before', value: 60 },
                                { label: '1 day before', value: 1440 },
                            ].map((option, index) => (
                                <ListItemButton
                                    key={option.value}
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => selectReminder(option.value)}
                                    sx={{ py: 0.5, minHeight: 'auto' }}
                                    autoFocus={index === 0}
                                    data-reminder-option
                                >
                                    <NotificationsNoneIcon sx={{ mr: 1, fontSize: '1rem', color: 'secondary.main' }} />
                                    <ListItemText
                                        primary={option.label}
                                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                                    />
                                </ListItemButton>
                            ))}
                            <ListItemButton
                                onMouseDown={event => event.preventDefault()}
                                onClick={openCustomReminder}
                                sx={{ py: 0.5, minHeight: 'auto' }}
                                data-reminder-option
                            >
                                <AccessTimeIcon sx={{ mr: 1, fontSize: '1rem', color: 'primary.main' }} />
                                <ListItemText
                                    primary="Custom"
                                    primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                                />
                            </ListItemButton>
                        </List>
                    )}

                    {suggestionType === 'reminder' && showCustomReminder && (
                        <Box sx={{ p: 1 }}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DateCalendar
                                    value={selectedReminderDate}
                                    onChange={newValue => setSelectedReminderDate(newValue || new Date())}
                                    sx={{
                                        width: '100%',
                                        '& .MuiPickersCalendarHeader-root': {
                                            paddingLeft: 1,
                                            paddingRight: 1,
                                        },
                                    }}
                                />

                                <Box sx={{ mb: 1.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                        Reminder time
                                    </Typography>
                                    <TimePicker
                                        value={selectedReminderTime}
                                        onChange={newValue => setSelectedReminderTime(newValue)}
                                        ampm={false}
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                size: 'small',
                                            },
                                        }}
                                    />
                                </Box>

                                {customReminderError && (
                                    <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                                        {customReminderError}
                                    </Typography>
                                )}

                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setShowCustomReminder(false);
                                            setCustomReminderError(null);
                                        }}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={confirmCustomReminder}
                                    >
                                        Confirm
                                    </Button>
                                </Box>
                            </LocalizationProvider>
                        </Box>
                    )}

                    {suggestionType === 'tag' && (
                        <List
                            dense
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const buttons = document.querySelectorAll('[data-tag-option]');
                                    const currentIndex = Array.from(buttons).findIndex(btn => btn === document.activeElement);
                                    const nextIndex = e.key === 'ArrowDown'
                                        ? Math.min(currentIndex + 1, buttons.length - 1)
                                        : Math.max(currentIndex - 1, 0);
                                    (buttons[nextIndex] as HTMLElement)?.focus();
                                }
                            }}
                        >
                            <ListItem sx={{ py: 0.5, minHeight: 'auto' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    Select Tag
                                </Typography>
                            </ListItem>
                            {tagOptions.map((option, index) => (
                                <ListItemButton
                                    key={option.label}
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => selectTag(option.label)}
                                    sx={{ py: 0.5, minHeight: 'auto' }}
                                    autoFocus={index === 0}
                                    data-tag-option
                                >
                                    <LabelIcon sx={{ mr: 1, fontSize: '1rem', color: option.color }} />
                                    <ListItemText
                                        primary={option.label}
                                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </Paper>
            </Popover>
        </Box>
    );
}

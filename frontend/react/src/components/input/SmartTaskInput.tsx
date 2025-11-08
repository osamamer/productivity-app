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
    IconButton,
    Grid,
    Button,
    Divider,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FlagIcon from '@mui/icons-material/Flag';
import LabelIcon from '@mui/icons-material/Label';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { TaskToCreate } from '../../types/TaskToCreate';

type SmartTaskInputProps = {
    onSubmit: (taskToCreate: TaskToCreate) => void;
    initialDate?: string;
    autoFocus?: boolean;
    parentId?: string;
};

type TaskMetadata = {
    importance: number;
    scheduledDate: string;
    tag: string;
};

export function SmartTaskInput({ onSubmit, initialDate, autoFocus, parentId }: SmartTaskInputProps) {
    const [input, setInput] = useState('');
    const [metadata, setMetadata] = useState<TaskMetadata>({
        importance: 0,
        scheduledDate: initialDate || '',
        tag: '',
    });
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [suggestionType, setSuggestionType] = useState<'priority' | 'date' | 'tag' | null>(null);
    const [showCustomDateTime, setShowCustomDateTime] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<Date | null>(new Date());
    const inputRef = useRef<HTMLInputElement>(null);

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
            getValue: () => {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}T12:00:00`;
            }
        },
        {
            label: 'Tomorrow',
            getValue: () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const year = tomorrow.getFullYear();
                const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
                const day = String(tomorrow.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}T12:00:00`;
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
            setAnchorEl(inputRef.current);
        } else if (text.includes('!date') || text.includes('!d')) {
            setSuggestionType('date');
            setShowCustomDateTime(false);
            setAnchorEl(inputRef.current);
        } else if (text.includes('!tag') || text.includes('!t')) {
            setSuggestionType('tag');
            setShowCustomDateTime(false);
            setAnchorEl(inputRef.current);
        } else {
            setAnchorEl(null);
            setSuggestionType(null);
            setShowCustomDateTime(false);
        }
    }, [input]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        let taskName = input
            .replace(/!priority|!p/gi, '')
            .replace(/!date|!d/gi, '')
            .replace(/!tag|!t/gi, '')
            .trim();

        if (taskName === '') return;

        const taskToCreate: TaskToCreate = {
            name: taskName,
            description: '',
            // CRITICAL FIX: Use metadata date OR fall back to initialDate
            scheduledPerformDateTime: metadata.scheduledDate || initialDate || '',
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
            tag: ''
        });
    };

    const selectPriority = (value: number) => {
        setMetadata({ ...metadata, importance: value });
        setInput(input.replace(/!priority|!p/gi, '').trim());
        setAnchorEl(null);
    };

    const selectDate = (dateValue: string) => {
        setMetadata({ ...metadata, scheduledDate: dateValue });
        setInput(input.replace(/!date|!d/gi, '').trim());
        setAnchorEl(null);
        setShowCustomDateTime(false);
    };

    const selectTag = (tagValue: string) => {
        setMetadata({ ...metadata, tag: tagValue });
        setInput(input.replace(/!tag|!t/gi, '').trim());
        setAnchorEl(null);
    };

    const clearMetadata = (field: keyof TaskMetadata) => {
        setMetadata({ ...metadata, [field]: field === 'importance' ? 0 : '' });
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

    return (
        <Box sx={{ width: '100%' }}>
            <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative' }}>
                <TextField
                    inputRef={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={ parentId ? "Add subtask..." : "Add task..."}
                    variant="standard"
                    fullWidth
                    sx={{
                        '& .MuiInput-root': {
                            fontSize: '0.95rem',
                        },
                    }}
                />

                {/* Metadata chips */}
                {(metadata.importance > 0 || metadata.scheduledDate || metadata.tag) && (
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
                <Paper sx={{ width: showCustomDateTime ? 320 : 200, maxHeight: showCustomDateTime ? 450 : 200, overflow: 'auto' }}>
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
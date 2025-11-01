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
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FlagIcon from '@mui/icons-material/Flag';
import LabelIcon from '@mui/icons-material/Label';
import CloseIcon from '@mui/icons-material/Close';
import { TaskToCreate } from '../../types/TaskToCreate';

type SmartTaskInputProps = {
    onSubmit: (taskToCreate: TaskToCreate) => void;
};

type TaskMetadata = {
    importance: number;
    scheduledDate: string;
    tag: string;
};

export function SmartTaskInput({ onSubmit }: SmartTaskInputProps) {
    const [input, setInput] = useState('');
    const [metadata, setMetadata] = useState<TaskMetadata>({
        importance: 0,
        scheduledDate: '',
        tag: '',
    });
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [suggestionType, setSuggestionType] = useState<'priority' | 'date' | 'tag' | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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
                // Format as ISO LocalDateTime: YYYY-MM-DDTHH:mm:ss
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
        {
            label: 'This Weekend',
            getValue: () => {
                const date = new Date();
                const day = date.getDay();
                const daysUntilSaturday = day === 0 ? 6 : (6 - day);
                date.setDate(date.getDate() + daysUntilSaturday);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const dayNum = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${dayNum}T12:00:00`;
            }
        },
        {
            label: 'Next Week',
            getValue: () => {
                const date = new Date();
                const day = date.getDay();
                const daysUntilNextMonday = day === 0 ? 1 : (8 - day);
                date.setDate(date.getDate() + daysUntilNextMonday);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const dayNum = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${dayNum}T12:00:00`;
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
            setAnchorEl(inputRef.current);
        } else if (text.includes('!date') || text.includes('!d')) {
            setSuggestionType('date');
            setAnchorEl(inputRef.current);
        } else if (text.includes('!tag') || text.includes('!t')) {
            setSuggestionType('tag');
            setAnchorEl(inputRef.current);
        } else {
            setAnchorEl(null);
            setSuggestionType(null);
        }
    }, [input]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Remove command keywords from task name
        let taskName = input
            .replace(/!priority|!p/gi, '')
            .replace(/!date|!d/gi, '')
            .replace(/!tag|!t/gi, '')
            .trim();

        if (taskName === '') return;

        const taskToCreate: TaskToCreate = {
            name: taskName,
            description: '',
            scheduledPerformDateTime: metadata.scheduledDate,
            tag: metadata.tag,
            importance: metadata.importance,
        };

        console.log('Creating task:', taskToCreate); // Debug log

        onSubmit(taskToCreate);
        setInput('');
        setMetadata({ importance: 0, scheduledDate: '', tag: '' });
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

        // Handle ISO LocalDateTime format: YYYY-MM-DDTHH:mm:ss
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

    return (
        <Box sx={{ width: '100%' }}>
            <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative' }}>
                <TextField
                    inputRef={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Add task..."
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
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <Paper sx={{ width: 200, maxHeight: 200, overflow: 'auto' }}>
                    {suggestionType === 'priority' && (
                        <List dense>
                            <ListItem sx={{ py: 0.5, minHeight: 'auto' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    Select Priority
                                </Typography>
                            </ListItem>
                            {priorityOptions.map((option) => (
                                <ListItemButton
                                    key={option.value}
                                    onClick={() => selectPriority(option.value)}
                                    sx={{ py: 0.5, minHeight: 'auto' }}
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

                    {suggestionType === 'date' && (
                        <List dense>
                            <ListItem sx={{ py: 0.5, minHeight: 'auto' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    Select Date
                                </Typography>
                            </ListItem>
                            {dateOptions.map((option) => (
                                <ListItemButton
                                    key={option.label}
                                    onClick={() => selectDate(option.getValue())}
                                    sx={{ py: 0.5, minHeight: 'auto' }}
                                >
                                    <CalendarTodayIcon sx={{ mr: 1, fontSize: '1rem', color: 'primary.main' }} />
                                    <ListItemText
                                        primary={option.label}
                                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    )}

                    {suggestionType === 'tag' && (
                        <List dense>
                            <ListItem sx={{ py: 0.5, minHeight: 'auto' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    Select Tag
                                </Typography>
                            </ListItem>
                            {tagOptions.map((option) => (
                                <ListItemButton
                                    key={option.label}
                                    onClick={() => selectTag(option.label)}
                                    sx={{ py: 0.5, minHeight: 'auto' }}
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
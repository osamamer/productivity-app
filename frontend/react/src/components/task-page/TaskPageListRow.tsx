import React, { useEffect, useRef, useState } from 'react';
import { alpha, Box, Checkbox, TextField, Typography, useTheme } from '@mui/material';
import { Task } from '../../types/Task';

type TaskPageListRowProps = {
    task: Task;
    onToggle: (taskId: string, anchorEl?: HTMLElement) => void;
    onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
    onSelect?: (task: Task) => void;
    onSelectionClick?: (task: Task, event: React.MouseEvent<HTMLElement>) => void;
    selected?: boolean;
    editRequestId?: number | null;
    showScheduledDate?: boolean;
    draggable?: boolean;
    onDragStart?: (task: Task) => void;
    onDragEnd?: () => void;
    isDragging?: boolean;
};

function checkboxColor(importance: number): string {
    if (importance > 7) return '#ef4444';
    if (importance > 4) return '#eab308';
    return '#1976d2';
}

function formatScheduledDate(dateTime: string): string {
    const date = new Date(dateTime);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (taskDate.getTime() === today.getTime()) return 'Today';
    if (taskDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
    if (taskDate.getTime() === yesterday.getTime()) return 'Yesterday';
    const daysDiff = Math.floor((taskDate.getTime() - today.getTime()) / 86_400_000);
    if (Math.abs(daysDiff) < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    if (date.getFullYear() !== now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const TaskPageListRow = React.memo(function TaskPageListRow({
    task,
    onToggle,
    onUpdate,
    onSelect,
    onSelectionClick,
    selected = false,
    editRequestId = null,
    showScheduledDate = false,
    draggable = false,
    onDragStart,
    onDragEnd,
    isDragging = false,
}: TaskPageListRowProps) {
    const theme = useTheme();
    const activeAccent = theme.palette.primary.main;
    const [localName, setLocalName] = useState(task.name ?? '');
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const handledEditRequestRef = useRef<number | null>(null);
    const dragAllowedRef = useRef(true);

    useEffect(() => setLocalName(task.name ?? ''), [task.name]);

    useEffect(() => {
        if (editRequestId === null || handledEditRequestRef.current === editRequestId) return;
        handledEditRequestRef.current = editRequestId;
        setEditing(true);
    }, [editRequestId]);

    useEffect(() => {
        if (!editing || !inputRef.current) return;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }, [editing]);

    const selectTask = (event: React.MouseEvent<HTMLElement>) => {
        onSelectionClick?.(task, event);
        onSelect?.(task);
    };

    const commitName = () => {
        const trimmedName = localName.trim();
        setEditing(false);
        setLocalName(trimmedName || task.name);
        if (trimmedName && trimmedName !== task.name) void onUpdate(task.taskId, { name: trimmedName });
    };

    const cancelNameEdit = () => {
        setLocalName(task.name);
        setEditing(false);
    };

    const scheduledLabel = showScheduledDate && task.scheduledPerformDateTime
        ? formatScheduledDate(task.scheduledPerformDateTime)
        : '';
    const color = checkboxColor(task.importance);

    return (
        <Box
            data-task-id={task.taskId}
            draggable={draggable}
            onClick={selectTask}
            onMouseDownCapture={event => {
                const target = event.target;
                dragAllowedRef.current = Boolean(draggable && !(target instanceof Element && target.closest(
                    'input, textarea, button, [role="button"], .MuiButtonBase-root, [contenteditable="true"], [data-task-name="true"]',
                )));
                event.currentTarget.draggable = dragAllowedRef.current;
            }}
            onMouseUpCapture={event => {
                event.currentTarget.draggable = draggable;
            }}
            onDragStart={event => {
                if (!draggable || !dragAllowedRef.current) {
                    event.preventDefault();
                    return;
                }
                event.stopPropagation();
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', task.taskId);
                onDragStart?.(task);
            }}
            onDragEnd={onDragEnd}
            sx={{
                position: 'relative',
                borderRadius: 1.5,
                border: '1.5px solid',
                borderColor: selected ? alpha(activeAccent, 0.38) : 'transparent',
                backgroundColor: selected ? alpha(activeAccent, 0.09) : 'transparent',
                overflow: 'hidden',
                mb: 0.25,
                opacity: isDragging ? 0.42 : 1,
                transform: isDragging ? 'scale(0.985)' : 'scale(1)',
                transition: 'opacity 0.16s, transform 0.16s, border-color 0.2s, background-color 0.2s',
                '&:hover': {
                    backgroundColor: selected ? alpha(activeAccent, 0.09) : alpha(activeAccent, 0.04),
                },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, px: 0.5 }}>
                <Checkbox
                    size="small"
                    checked={task.completed}
                    onChange={event => onToggle(task.taskId, event.currentTarget.parentElement ?? event.currentTarget)}
                    sx={{ color, '&.Mui-checked': { color }, mr: 0.5 }}
                />
                <Box
                    data-task-text-area="true"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        position: 'relative',
                        maxHeight: '6.3em',
                        overflowY: editing ? 'hidden' : 'auto',
                        overflowX: 'hidden',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        textAlign: 'left',
                        lineHeight: 1.5,
                        top: '-1px',
                    }}
                >
                    <Box
                        component="span"
                        data-task-name="true"
                        onClick={event => {
                            event.stopPropagation();
                            selectTask(event);
                            setEditing(true);
                        }}
                        sx={{
                            display: 'inline-block',
                            width: 'max-content',
                            maxWidth: 'calc(100% - 8px)',
                            paddingRight: '32px',
                            boxSizing: 'border-box',
                            textAlign: 'left',
                            cursor: 'text',
                        }}
                    >
                        <Typography
                            component="span"
                            sx={{
                                fontSize: '1.05rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                color: task.completed ? 'text.disabled' : 'text.primary',
                                textDecoration: task.completed ? 'line-through' : 'none',
                                visibility: editing ? 'hidden' : 'visible',
                                textAlign: 'left',
                            }}
                        >
                            {editing ? localName : task.name}
                        </Typography>
                    </Box>
                    {editing && (
                        <TextField
                            value={localName}
                            inputRef={inputRef}
                            autoComplete="off"
                            onClick={event => event.stopPropagation()}
                            onChange={event => setLocalName(event.target.value)}
                            onBlur={commitName}
                            onKeyDown={event => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    commitName();
                                }
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelNameEdit();
                                }
                            }}
                            variant="standard"
                            autoFocus
                            fullWidth
                            multiline
                            minRows={1}
                            maxRows={4}
                            InputProps={{ disableUnderline: true }}
                            inputProps={{ draggable: false, 'data-task-name-input': 'true' }}
                            sx={{
                                position: 'absolute',
                                inset: '0 32px 0 0',
                                width: 'auto',
                                '& .MuiInputBase-root': { height: '100%', padding: 0 },
                                '& .MuiInputBase-input': {
                                    color: task.completed ? 'text.disabled' : 'text.primary',
                                    textDecoration: task.completed ? 'line-through' : 'none',
                                    fontSize: '1.05rem',
                                    lineHeight: 1.5,
                                    padding: 0,
                                    textAlign: 'left',
                                },
                            }}
                        />
                    )}
                </Box>
                {scheduledLabel && (
                    <Typography variant="body2" color="text.secondary" sx={{ mx: 1.5, minWidth: 84, textAlign: 'right', flexShrink: 0 }}>
                        {scheduledLabel}
                    </Typography>
                )}
            </Box>
        </Box>
    );
});

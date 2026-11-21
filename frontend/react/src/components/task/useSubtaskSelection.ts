import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { alpha, SxProps, Theme } from '@mui/material/styles';
import { Task } from '../../types/Task';

export function useSubtaskSelection(items: Task[]) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const anchorId = useRef<string | null>(null);
    const selected = useMemo(() => items.filter(item => selectedIds.includes(item.taskId)), [items, selectedIds]);

    useEffect(() => {
        setSelectedIds(current => {
            const existing = current.filter(id => items.some(item => item.taskId === id));
            return existing.length === current.length ? current : existing;
        });
    }, [items]);

    const select = (subtask: Task, event: MouseEvent<HTMLElement>) => {
        const id = subtask.taskId;
        if (event.shiftKey && anchorId.current) {
            const anchorIndex = items.findIndex(item => item.taskId === anchorId.current);
            const index = items.findIndex(item => item.taskId === id);
            if (anchorIndex >= 0 && index >= 0) {
                const range = items.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1);
                setSelectedIds(current => [...new Set([...current, ...range.map(item => item.taskId)])]);
                return;
            }
        }
        if (event.ctrlKey || event.metaKey) {
            setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
        } else {
            setSelectedIds([id]);
        }
        anchorId.current = id;
    };

    const isMarked = (index: number) => selectedIds.length > 1
        && index >= 0 && index < items.length && selectedIds.includes(items[index].taskId);

    // Adjacent selected rows join into one block so a range reads as a single selection.
    const rowSx = (index: number): SxProps<Theme> => {
        if (!isMarked(index)) return {};
        const joinedAbove = isMarked(index - 1);
        const joinedBelow = isMarked(index + 1);
        return {
            backgroundColor: theme => alpha(theme.palette.primary.main, 0.1),
            boxShadow: theme => `inset 3px 0 0 ${theme.palette.primary.main}`,
            borderTopLeftRadius: joinedAbove ? 0 : 6,
            borderTopRightRadius: joinedAbove ? 0 : 6,
            borderBottomLeftRadius: joinedBelow ? 0 : 6,
            borderBottomRightRadius: joinedBelow ? 0 : 6,
            '&:hover': { backgroundColor: theme => alpha(theme.palette.primary.main, 0.14) },
        };
    };

    return { selected, selectedIds, select, rowSx, clear: () => setSelectedIds([]) };
}

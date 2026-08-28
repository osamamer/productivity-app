import { memo } from 'react';
import {
    Box,
    Chip,
    List,
    ListItemButton,
    Stack,
    Typography,
    alpha,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { MentalThread } from '../../types/MentalThread.ts';
import {
    attentionStateDetails,
    closureTypeLabels,
    resolvedThreadColor,
} from './mentalThreadPresentation.ts';

interface MentalThreadListProps {
    threads: MentalThread[];
    selectedId: string | null;
    onSelect: (threadId: string) => void;
}

interface MentalThreadRowProps {
    thread: MentalThread;
    isSelected: boolean;
    isLast: boolean;
    onSelect: (threadId: string) => void;
}

function formatDate(date: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
        .format(new Date(`${date}T12:00:00`));
}

const MentalThreadRow = memo(function MentalThreadRow({
    thread,
    isSelected,
    isLast,
    onSelect,
}: MentalThreadRowProps) {
    const presentation = attentionStateDetails[thread.attentionState];
    const isResolved = thread.status === 'CLOSED' && thread.closureType === 'RESOLVED';
    const loadColor = isResolved ? resolvedThreadColor : presentation.color;

    return (
        <ListItemButton
            selected={isSelected}
            onClick={() => onSelect(thread.id)}
            sx={{
                display: 'block',
                px: 2,
                py: 1.25,
                borderBottom: isLast ? 0 : 1,
                borderColor: 'divider',
                borderLeft: `3px solid ${isSelected ? loadColor : 'transparent'}`,
                '&.Mui-selected': { bgcolor: alpha(loadColor, 0.08) },
                '&.Mui-selected:hover': { bgcolor: alpha(loadColor, 0.12) },
            }}
        >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap>{thread.title}</Typography>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.75 }}>
                        {thread.status === 'CLOSED' ? (
                            <Chip
                                size="small"
                                icon={<CheckCircleOutlineRoundedIcon />}
                                label={thread.closureType ? closureTypeLabels[thread.closureType] : 'Closed'}
                                color={isResolved ? 'success' : 'default'}
                                variant="outlined"
                            />
                        ) : (
                            <Chip
                                size="small"
                                label={presentation.label}
                                sx={{ color: presentation.color, bgcolor: alpha(presentation.color, 0.1) }}
                            />
                        )}
                        {thread.targetCloseDate && (
                            <Typography variant="caption" color="text.secondary">
                                target {formatDate(thread.targetCloseDate)}
                            </Typography>
                        )}
                    </Stack>
                </Box>
                <Typography variant="subtitle2" fontWeight={750} color={loadColor}>
                    {thread.currentMentalLoad}<Typography component="span" variant="caption" color="text.secondary">/10</Typography>
                </Typography>
            </Stack>
            <Box
                aria-label={`Mental load ${thread.currentMentalLoad} out of 10`}
                sx={{
                    mt: 1,
                    height: 6,
                    borderRadius: 3,
                    bgcolor: isResolved ? alpha(loadColor, 0.16) : 'action.hover',
                    overflow: 'hidden',
                }}
            >
                <Box sx={{
                    width: `${thread.currentMentalLoad * 10}%`,
                    height: '100%',
                    borderRadius: 3,
                    bgcolor: loadColor,
                }} />
            </Box>
        </ListItemButton>
    );
});

export function MentalThreadList({ threads, selectedId, onSelect }: MentalThreadListProps) {
    if (threads.length === 0) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="subtitle1" fontWeight={650}>No threads in this view</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Try another state or capture what keeps resurfacing.
                </Typography>
            </Box>
        );
    }

    return (
        <List disablePadding>
            {threads.map((thread, index) => (
                <MentalThreadRow
                    key={thread.id}
                    thread={thread}
                    isSelected={thread.id === selectedId}
                    isLast={index === threads.length - 1}
                    onSelect={onSelect}
                />
            ))}
        </List>
    );
}
